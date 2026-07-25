import time
import threading
import random
from datetime import datetime, timedelta, timezone
from point_rules import CLASS_NAME_MAP, calculate_points
import qr_generator
import api_client

class RecyclingSession:
    def __init__(self, countdown_time=5.0, qr_display_time=30.0, demo_mode=False):
        self.countdown_time = countdown_time
        self.qr_display_time = qr_display_time
        self.demo_mode = demo_mode
        
        # State: "idle" | "detecting" | "accepted" | "countdown" | "loading" | "qr_display"
        self.state = "idle" 
        self.items = {} # {"plastic_bottle": 2, "can": 1}
        
        self.state_start_time = 0.0
        
        self.last_accepted_class = None
        self.last_accepted_time = 0.0
        self.duplicate_cooldown = 2.0 # seconds to ignore the same object class to prevent double counting
        
        self.qr_image = None
        self.points_earned = 0
        self.last_best_detection = None
        
    def get_items_list(self):
        """Convert internal dict to the list format the backend expects."""
        return [{"itemType": k, "quantity": v} for k, v in self.items.items()]

    def transition(self, new_state):
        self.state = new_state
        self.state_start_time = time.time()
        
    def reset(self):
        self.items = {}
        self.qr_image = None
        self.points_earned = 0
        self.last_accepted_class = None
        self.last_best_detection = None
        self.transition("idle")

    def toggle_detection(self):
        """For demo mode: manually start or stop detection."""
        if self.state == "idle":
            self.transition("detecting")
        elif self.state == "detecting":
            self.transition("idle")
            
    def _generate_random_items(self):
        """Generate random items for demo QR codes."""
        items = {}
        classes = ["plastic_bottle", "can", "carton"]
        for cls in classes:
            if random.random() < 0.8:
                items[cls] = random.randint(1, 5)
        if not items:
            items["plastic_bottle"] = 1
        return items

    def generate_qr(self):
        """For demo mode: immediately generate QR from accumulated items."""
        if self.demo_mode:
            # Demo: always generate with random items, no need for real detections
            self.items = self._generate_random_items()
        elif not self.items:
            print("No items to generate QR for!")
            return
            
        self.transition("loading")
        # In demo mode, we can do this synchronously since it's user-triggered
        self._do_loading_work()
        
    def _do_loading_work(self):
        """Run in a thread to generate QR and call API so we don't freeze the camera UI."""
        items_list = self.get_items_list()
        self.points_earned = calculate_points(items_list)
        
        # Use longer expiry in demo mode so judges have time to scan
        expiry_seconds = 30 * 60 if self.demo_mode else self.qr_display_time
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expiry_seconds)
        expires_str = expires_at.isoformat().replace('+00:00', 'Z')
        
        qr_string, claim_token = qr_generator.build_signed_payload(
            items=items_list,
            total_points=self.points_earned,
            expires_at_str=expires_str
        )
        
        ok, err = api_client.report_session(claim_token, items_list)
        if not ok:
            print(f"Failed to register session with backend: {err}")
            self.transition("idle")
            return

        self.qr_image = qr_generator.generate_qr_image(qr_string, box_size=8, border=4)
        self.transition("qr_display")

    def process_frame(self, detections, conf_threshold):
        now = time.time()
        
        # Determine best detection
        best_detection = None
        if detections:
            best = max(detections, key=lambda item: item["confidence"])
            if best["confidence"] >= conf_threshold:
                best_detection = best
        
        if best_detection:
            self.last_best_detection = best_detection

        # State Machine Logic
        if self.state == "idle":
            if not self.demo_mode and best_detection:
                self.transition("detecting")
                
        elif self.state == "detecting":
            if best_detection:
                raw_class = best_detection["class_name"]
                mapped_class = CLASS_NAME_MAP.get(raw_class, raw_class)
                
                # Check cooldown to prevent double counting
                if raw_class == self.last_accepted_class and (now - self.last_accepted_time) < self.duplicate_cooldown:
                    pass # ignore it, it's the same item
                else:
                    self.items[mapped_class] = self.items.get(mapped_class, 0) + 1
                    self.last_accepted_class = raw_class
                    self.last_accepted_time = now
                    
                    if not self.demo_mode:
                        self.transition("accepted")
            else:
                # If we lose the object for a bit, go back to idle
                if not self.demo_mode and (now - self.state_start_time > 1.0):
                    self.transition("idle")
                    
        elif self.state == "accepted":
            if not self.demo_mode and (now - self.state_start_time > 1.5):
                self.transition("countdown")
                
        elif self.state == "countdown":
            if best_detection:
                raw_class = best_detection["class_name"]
                # Only reset countdown if it's a NEW item (respect cooldown)
                if not (raw_class == self.last_accepted_class and (now - self.last_accepted_time) < self.duplicate_cooldown):
                    self.transition("detecting")
            
            elapsed = now - self.state_start_time
            if elapsed >= self.countdown_time:
                self.transition("loading")
                threading.Thread(target=self._do_loading_work, daemon=True).start()
                
        elif self.state == "loading":
            # Just wait for the thread to change the state to qr_display
            pass
            
        elif self.state == "qr_display":
            if not self.demo_mode:
                elapsed = now - self.state_start_time
                if elapsed >= self.qr_display_time:
                    self.reset()
                
        return self.state
