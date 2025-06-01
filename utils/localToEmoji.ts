export default function localToEmoji(local: string): string {
  switch (local) {
    case "en":
    case "en_gb":
    case "en_ca":
    case "en_us": {
      return "🇺🇸";
    }
    case "en_pirate": {
      return "🏴‍☠️";
    }

    default: {
      return "❓";
    }
  }
}
