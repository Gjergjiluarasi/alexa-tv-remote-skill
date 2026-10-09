# Alexa TV Remote Skill

This repository turns the Python ADB remote control script into an Alexa skill project that follows the standard Amazon Alexa-hosted skill pattern.

The Alexa skill is implemented as a Lambda function in Node.js, while the actual Android TV control logic remains in a small local Python service that runs on a machine on the same LAN as the TV.

## Architecture

- Alexa Developer Console / Alexa-hosted skill configuration triggers an Alexa intent.
- The Lambda function receives the request and calls the local Python controller service over HTTP.
- The local Python service maintains the ADB connection to the TV and executes `adb shell input keyevent` commands.

This separation keeps the skill deployable in Amazon's hosted environment while preserving the original ADB behavior from the Python script.

## Files

- `lambda/index.js` – Alexa request handlers and intent routing
- `lambda/adbController.js` – HTTP client used by Lambda
- `service/tv_controller.py` – local Python service for ADB + Android TV commands
- `skill-package/skill.json` – skill metadata
- `skill-package/interactionModels/custom/en-US.json` – intent model and utterances

## Requirements

- Amazon Alexa Developer account
- Node.js 18+
- Python 3.11+
- Local machine on the same network as the TV
- Android Debug Bridge (`adb`) installed on the controller machine

## Local controller setup

1. Edit the values in `service/tv_controller.py`:
   - `TV_IP`
   - `ADB_DEVICE`
2. Install Python dependencies:

   ```bash
   python3 -m pip install flask
   ```

3. Start the local service:

   ```bash
   python3 service/tv_controller.py
   ```

   The service listens on port `8080` by default.

## Lambda configuration

1. In the Alexa Developer Console, create a custom skill.
2. Add the skill package under `skill-package/`.
3. Configure the AWS Lambda function to use `lambda/index.js`.
4. Set the environment variable `TV_REMOTE_BASE_URL` to your local service URL, for example:

   ```bash
   http://192.168.1.109:8080
   ```

5. Test with phrases such as:
   - "Alexa, ask TV remote to turn on the TV"
   - "Alexa, ask TV remote to volume up"
   - "Alexa, ask TV remote to pause"
   - "Alexa, ask TV remote to go home"

## Supported actions

- power on
- power off
- volume up
- volume down
- mute
- unmute
- play
- pause
- fast forward
- rewind
- home
- back
- select
- up
- down
- left
- right
- open app

## Notes

The original Python script is preserved as an ADB controller, but in a production Alexa-hosted skill, the Lambda should call an always-on LAN service instead of executing ADB directly from AWS. This is the recommended Amazon-compatible pattern for home automation integrations.
