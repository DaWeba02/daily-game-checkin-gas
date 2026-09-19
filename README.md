# Daily Game Check-In

Google Apps Script automation for daily reward check-ins with optional Discord notifications.

Supported check-ins:

- Zenless Zone Zero
- Genshin Impact
- Honkai: Star Rail
- Arknights: Endfield

The script stores all sensitive configuration in Google Apps Script Script Properties.

## Features

- Daily HoYoLAB check-ins for Zenless Zone Zero, Genshin Impact, and Honkai: Star Rail
- Daily SKPORT check-in for Arknights: Endfield
- Multiple Endfield profiles via one JSON Script Property
- Discord summary message after each run
- One Discord retry after HTTP 429 rate limiting
- Manual test functions for each service
- Trigger installer for a daily run around 18:20 Europe/Vienna
- Timestamped log output in Europe/Vienna and UTC+8

## Repository Structure

```text
daily-game-checkin/
├── Code.js
├── README.md
├── LICENSE
├── appsscript.json
├── .gitignore
└── examples/
    └── script-properties.example.json
```

## Script Properties

Create these values in Google Apps Script under:

```text
Project Settings -> Script Properties
```

Required for Zenless Zone Zero, Genshin Impact, and Honkai: Star Rail:

```text
HOYOLAB_COOKIE
```

Example format:

```text
ltoken_v2=YOUR_TOKEN; ltuid_v2=YOUR_UID;
```

Required for Arknights: Endfield:

```text
ENDFIELD_PROFILES_JSON
```

Example format:

```json
[
  {
    "accountName": "main",
    "cred": "YOUR_ENDFIELD_CRED",
    "skGameRole": "YOUR_SK_GAME_ROLE",
    "platform": "3",
    "vName": "1.0.0"
  }
]
```

Optional for Discord notifications:

```text
DISCORD_WEBHOOK
```

Example format:

```text
https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
```

## Installation

1. Create a new project at [Google Apps Script](https://script.google.com/).
2. Replace the default code with the contents of `Code.js`.
3. Open `Project Settings`.
4. Add the Script Properties listed above.
5. Save the project.
6. Run `testZZZOnly`, `testGenshinOnly`, `testHonkaiStarRailOnly`, and `testEndfieldOnly` once to authorize the script and verify each check-in.
7. If Discord is configured, run `testDiscordOnly`.
8. Run `installDailyTrigger` once.

Google Apps Script will ask for permissions the first time the script uses external requests or installs a trigger.

## Testing

Use these functions from the Apps Script editor:

```text
testZZZOnly
```

Checks only Zenless Zone Zero.

```text
testGenshinOnly
```

Checks only Genshin Impact.

```text
testHonkaiStarRailOnly
```

Checks only Honkai: Star Rail.

```text
testEndfieldOnly
```

Checks all configured Endfield profiles.

```text
testDiscordOnly
```

Sends a simple Discord test message.

```text
testAllWithoutDiscord
```

Runs all check-ins and logs the result without sending a Discord notification.

```text
checkInDailyRewards
```

Runs the full daily workflow and sends the Discord summary if `DISCORD_WEBHOOK` is configured.

Successful results may say either `success` or `already checked in`, depending on whether the daily reward was already claimed.

## Daily Trigger

Run this function once:

```text
installDailyTrigger
```

It deletes existing project triggers and creates one daily trigger for:

```text
checkInDailyRewards
```

The trigger is scheduled around:

```text
18:20 Europe/Vienna
```

Google Apps Script time-based triggers are approximate, so the run may happen a few minutes before or after the target time.

## Security

Store `HOYOLAB_COOKIE`, `ENDFIELD_PROFILES_JSON`, and `DISCORD_WEBHOOK` only in Script Properties. Treat all of them as secrets. If one is exposed, replace it immediately.

## Troubleshooting

### HoYoLAB says already checked in

This is usually fine. It means the reward was already claimed for the current day.

### HoYoLAB risk check or CAPTCHA

Check in manually for that day. Automated requests can occasionally be challenged.

### Endfield token refresh failed

Refresh the Endfield `cred` and `skGameRole` values, then update `ENDFIELD_PROFILES_JSON` in Script Properties.

### Endfield JSON is invalid

Validate `ENDFIELD_PROFILES_JSON` with a JSON validator. It must be an array, even if you only use one account.

### Discord returns HTTP 429

The script waits and retries once. Avoid repeatedly running `testDiscordOnly` within a short time.

### Discord returns HTTP 401 or 404

The webhook URL is usually wrong, incomplete, deleted, or copied from the wrong Discord channel.

### No Discord message appears

Check that `DISCORD_WEBHOOK` exists in Script Properties and that the Apps Script execution log says Discord was configured.

## Disclaimer

This project uses unofficial web endpoints and browser-style request flows. They can change or stop working at any time. Use at your own risk and respect the terms and rules of the relevant services.

## License

Released under the [MIT License](LICENSE).
