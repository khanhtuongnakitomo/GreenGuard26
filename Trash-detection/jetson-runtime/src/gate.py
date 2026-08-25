"""Temporal PET gate logic (Python 3.6)."""
import time
from collections import deque

import cv2
import numpy as np

from postprocess import center_in_poly, pick_top1_per_class

M2_NAMES = {0: "cap", 1: "label", 2: "ring"}
M2_COLORS = {0: (0, 0, 255), 1: (0, 255, 255), 2: (255, 0, 255)}


class M1FrameResult(object):
    def __init__(self, poly=None, is_pet=False, color=(160, 160, 160), legend=""):
        self.poly = poly
        self.is_pet = is_pet
        self.color = color
        self.legend = legend


class M2Hit(object):
    def __init__(self, name, confidence, polygon, class_id):
        self.name = name
        self.confidence = confidence
        self.polygon = polygon
        self.class_id = class_id


def smooth_poly(prev, new, alpha):
    new_f = new.astype(np.float32)
    if prev is None or prev.shape != new_f.shape:
        return new_f
    return (alpha * new_f) + ((1.0 - alpha) * prev.astype(np.float32))


class GateState(object):
    def __init__(self, vote_window):
        self.vote = deque(maxlen=vote_window)
        self.held_box = None
        self.held_is_pet = False
        self.held_color = (160, 160, 160)
        self.held_legend = ""
        self.miss_frames = 0
        self.pet_since = None
        self.locked_verdict = ""
        self.locked_color = (160, 160, 160)
        self.locked_hits = []
        self.locked_until = 0.0


class PetGate(object):
    def __init__(self, cfg):
        gate = cfg["gate"]
        m1 = cfg["m1"]
        m2 = cfg["m2"]
        self.warmup_s = float(gate["warmup_s"])
        self.verdict_hold_s = float(gate["verdict_hold_s"])
        self.vote_window = int(gate["vote_window"])
        self.vote_need = max(1, min(int(gate["vote_need"]), self.vote_window))
        self.miss_hold = int(m1["miss_hold"])
        self.box_alpha = float(m1["box_smooth"])
        self.m2_infer_conf = float(m2["infer_conf"])
        self.m2_violation_conf = float(m2["violation_conf"])
        self.state = GateState(self.vote_window)

    def reset(self):
        self.state = GateState(self.vote_window)

    def update_m1_hold(self, raw, now=None):
        st = self.state
        if raw.poly is not None:
            st.miss_frames = 0
            st.held_box = smooth_poly(st.held_box, raw.poly, self.box_alpha)
            st.held_is_pet = raw.is_pet
            st.held_color = raw.color
            st.held_legend = raw.legend
        elif st.held_box is not None and st.miss_frames < self.miss_hold:
            st.miss_frames += 1
        else:
            st.held_box = None
            st.held_is_pet = False
            st.held_legend = ""
            st.miss_frames = 0
            st.pet_since = None
            st.vote.clear()
            now_val = now if now is not None else time.perf_counter()
            if now_val >= st.locked_until:
                st.locked_verdict = ""
                st.locked_hits = []

        if st.held_box is None:
            return None
        return M1FrameResult(
            poly=st.held_box.astype(np.int32),
            is_pet=st.held_is_pet,
            color=st.held_color,
            legend=st.held_legend,
        )

    def evaluate_pet(self, frame_result, m2_hits, now=None):
        now_val = now if now is not None else time.perf_counter()
        st = self.state
        verdict = ""
        vcolor = (160, 160, 160)
        legend = []
        gate_active = False

        if frame_result.legend:
            legend.append((frame_result.legend, frame_result.color))

        if not frame_result.is_pet:
            st.pet_since = None
            st.vote.clear()
            if now_val >= st.locked_until:
                st.locked_verdict = ""
                st.locked_hits = []
            return {"verdict": verdict, "color": vcolor, "legend": legend, "gate_active": gate_active, "m2_hits": []}

        if st.pet_since is None:
            st.pet_since = now_val
        gate_active = True
        warm = now_val - st.pet_since
        warming = warm < self.warmup_s

        if st.locked_verdict and now_val < st.locked_until:
            verdict, vcolor = st.locked_verdict, st.locked_color
            for name, cf in st.locked_hits:
                cid = next((k for k, v in M2_NAMES.items() if v == name), None)
                color = M2_COLORS.get(cid, (255, 255, 255))
                legend.append(("%s %.0f%%" % (name, cf * 100), color))
            return {
                "verdict": verdict,
                "color": vcolor,
                "legend": legend,
                "gate_active": gate_active,
                "m2_hits": [],
            }

        hits = []
        visible = []
        for hit in m2_hits:
            color = M2_COLORS.get(hit.class_id, (255, 255, 255))
            legend.append(("%s %.0f%%" % (hit.name, hit.confidence * 100), color))
            visible.append(hit)
            if hit.confidence >= self.m2_violation_conf:
                hits.append((hit.name, hit.confidence))

        if warming:
            remain = self.warmup_s - warm
            verdict = "PET locked — inspecting in %.1fs" % remain
            vcolor = (0, 200, 255)
            st.vote.clear()
        else:
            st.vote.append("REJECT" if hits else "ACCEPT")
            rejects = st.vote.count("REJECT")
            accepts = st.vote.count("ACCEPT")
            if rejects >= self.vote_need:
                parts = ", ".join("%s %.0f%%" % (k, v * 100) for k, v in hits) or "residual"
                verdict = "PET REJECT — %s" % parts
                vcolor = (0, 0, 255)
                st.locked_verdict = verdict
                st.locked_color = vcolor
                st.locked_hits = list(hits)
                st.locked_until = now_val + self.verdict_hold_s
                st.vote.clear()
            elif accepts >= self.vote_need:
                verdict = "PET ACCEPT (no cap/label/ring)"
                vcolor = (0, 200, 0)
                st.locked_verdict = verdict
                st.locked_color = vcolor
                st.locked_hits = []
                st.locked_until = now_val + self.verdict_hold_s
                st.vote.clear()
            else:
                verdict = "judging... %dR/%dA need %d/%d" % (
                    rejects,
                    accepts,
                    self.vote_need,
                    self.vote_window,
                )

        return {
            "verdict": verdict,
            "color": vcolor,
            "legend": legend,
            "gate_active": gate_active,
            "m2_hits": visible,
        }
