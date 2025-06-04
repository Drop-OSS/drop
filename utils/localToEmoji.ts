export default function localToEmoji(local: string): string {
  switch (local) {
    case "en":
    case "en-gb":
    case "en-ca":
    case "en-au":
    case "en-us": {
      return "🇺🇸";
    }
    case "en-pirate": {
      return "🏴‍☠️";
    }

    default: {
      return "❓";
    }
  }
}
