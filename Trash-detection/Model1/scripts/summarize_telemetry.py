import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path


def average(values):
    values = list(values)
    if not values:
        return 0.0
    return sum(values) / len(values)


def load_events(path):
    with path.open("r", encoding="utf-8") as file:
        for line_number, line in enumerate(file, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as exc:
                print(f"Skipping invalid JSON on line {line_number}: {exc}")


def summarize(events):
    events = list(events)
    decisions = Counter(event.get("decision", "unknown") for event in events)
    classes = Counter(event.get("best_class") for event in events if event.get("best_class"))
    model_types = Counter(event.get("model_type", "unknown") for event in events)
    devices = Counter(event.get("device_id", "unknown") for event in events)

    confidence_by_class = defaultdict(list)
    for event in events:
        class_name = event.get("best_class")
        if class_name:
            confidence_by_class[class_name].append(float(event.get("best_confidence", 0.0)))

    inference_ms = [float(event.get("inference_ms", 0.0)) for event in events]
    fps = [float(event.get("fps", 0.0)) for event in events]
    accepted = decisions.get("accepted", 0)
    rejected = decisions.get("low_conf", 0) + decisions.get("no_detection", 0)
    total = len(events)

    return {
        "total_events": total,
        "accepted": accepted,
        "rejected": rejected,
        "accept_rate": accepted / total if total else 0.0,
        "reject_rate": rejected / total if total else 0.0,
        "decisions": decisions,
        "classes": classes,
        "model_types": model_types,
        "devices": devices,
        "avg_inference_ms": average(inference_ms),
        "avg_fps": average(fps),
        "confidence_by_class": {
            class_name: average(values) for class_name, values in confidence_by_class.items()
        },
    }


def print_summary(summary):
    print("Telemetry Summary")
    print("=================")
    print(f"Total events:      {summary['total_events']}")
    print(f"Accepted:          {summary['accepted']}")
    print(f"Rejected:          {summary['rejected']}")
    print(f"Accept rate:       {summary['accept_rate']:.1%}")
    print(f"Reject rate:       {summary['reject_rate']:.1%}")
    print(f"Avg inference:     {summary['avg_inference_ms']:.2f} ms")
    print(f"Avg FPS:           {summary['avg_fps']:.2f}")

    print("\nDecisions")
    for decision, count in summary["decisions"].most_common():
        print(f"- {decision}: {count}")

    print("\nClasses")
    if summary["classes"]:
        for class_name, count in summary["classes"].most_common():
            avg_conf = summary["confidence_by_class"].get(class_name, 0.0)
            print(f"- {class_name}: {count} events, avg confidence {avg_conf:.1%}")
    else:
        print("- none")

    print("\nModel types")
    for model_type, count in summary["model_types"].most_common():
        print(f"- {model_type}: {count}")

    print("\nDevices")
    for device_id, count in summary["devices"].most_common():
        print(f"- {device_id}: {count}")


def parse_args():
    parser = argparse.ArgumentParser(description="Summarize trash detection telemetry JSONL.")
    parser.add_argument("path", nargs="?", default="logs/telemetry.jsonl", help="Telemetry JSONL file path")
    return parser.parse_args()


def main():
    args = parse_args()
    path = Path(args.path)
    if not path.exists():
        print(f"Telemetry file not found: {path}")
        return

    print_summary(summarize(load_events(path)))


if __name__ == "__main__":
    main()
