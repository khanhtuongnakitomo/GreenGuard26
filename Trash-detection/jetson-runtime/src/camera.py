"""Camera capture with latest-frame queue (Python 3.6)."""
import threading
from collections import deque

import cv2


class Camera(object):
    def __init__(self, source, gstreamer=None):
        self.source = source
        self.gstreamer = gstreamer
        self.cap = None
        self.queue = deque(maxlen=1)
        self.lock = threading.Lock()
        self.thread = None
        self.running = False

    def _open_capture(self):
        if self.gstreamer:
            return cv2.VideoCapture(self.gstreamer, cv2.CAP_GSTREAMER)
        if isinstance(self.source, int) or (isinstance(self.source, str) and self.source.isdigit()):
            return cv2.VideoCapture(int(self.source))
        return cv2.VideoCapture(self.source)

    def open(self):
        self.cap = self._open_capture()
        if not self.cap.isOpened():
            return False
        self.running = True
        self.thread = threading.Thread(target=self._reader)
        self.thread.daemon = True
        self.thread.start()
        return True

    def _reader(self):
        while self.running:
            ok, frame = self.cap.read()
            if not ok:
                continue
            with self.lock:
                self.queue.clear()
                self.queue.append(frame)

    def read(self):
        with self.lock:
            if not self.queue:
                return False, None
            return True, self.queue[-1].copy()

    def release(self):
        self.running = False
        if self.thread is not None:
            self.thread.join(timeout=1.0)
        if self.cap is not None:
            self.cap.release()
            self.cap = None
