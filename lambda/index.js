const Alexa = require('ask-sdk-core');
const { sendRemoteAction, getStatus } = require('./adbController');

const ACTION_MAP = {
  'turn on the tv': 'power_on',
  'turn off the tv': 'power_off',
  'mute': 'mute',
  'unmute': 'unmute',
  'volume up': 'volume_up',
  'volume down': 'volume_down',
  'play': 'play',
  'pause': 'pause',
  'go home': 'home',
  'go back': 'back',
  'select': 'select',
  'up': 'up',
  'down': 'down',
  'left': 'left',
  'right': 'right',
};

function getActionFromIntent(handlerInput) {
  const request = handlerInput.requestEnvelope.request;

  if (request.type === 'IntentRequest') {
    const intentName = request.intent.name;
    const slot = request.intent.slots && request.intent.slots.command;
    const slotValue = slot && slot.value;

    if (intentName === 'TVCommandIntent' && slotValue) {
      return ACTION_MAP[slotValue.toLowerCase()] || slotValue.toLowerCase().replace(/\s+/g, '_');
    }

    if (intentName === 'AMAZON.VolumeUpIntent') return 'volume_up';
    if (intentName === 'AMAZON.VolumeDownIntent') return 'volume_down';
    if (intentName === 'AMAZON.NavigateHomeIntent') return 'home';
    if (intentName === 'AMAZON.PauseIntent') return 'pause';
    if (intentName === 'AMAZON.ResumeIntent') return 'play';
  }

  return null;
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  async handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('TV Remote is ready. Ask me to turn on the TV, increase the volume, or go home.')
      .reprompt('What would you like the TV to do?')
      .getResponse();
  },
};

const TVCommandHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && (
      request.intent.name === 'TVCommandIntent' ||
      request.intent.name === 'AMAZON.VolumeUpIntent' ||
      request.intent.name === 'AMAZON.VolumeDownIntent' ||
      request.intent.name === 'AMAZON.NavigateHomeIntent' ||
      request.intent.name === 'AMAZON.PauseIntent' ||
      request.intent.name === 'AMAZON.ResumeIntent'
    );
  },
  async handle(handlerInput) {
    const action = getActionFromIntent(handlerInput);

    if (!action) {
      return handlerInput.responseBuilder
        .speak('I could not determine which command to send to the TV.')
        .getResponse();
    }

    try {
      const result = await sendRemoteAction(action);

      if (!result.ok) {
        throw new Error(`TV controller returned status ${result.statusCode}`);
      }

      return handlerInput.responseBuilder
        .speak(`Sending ${action.replace(/_/g, ' ')} to the TV.`)
        .getResponse();
    } catch (error) {
      console.error('TV command failed', error);
      return handlerInput.responseBuilder
        .speak('I could not reach the TV controller. Please check that the local controller is running and the network is available.')
        .getResponse();
    }
  },
};

const StatusIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'StatusIntent';
  },
  async handle(handlerInput) {
    try {
      const result = await getStatus();
      const state = result.body && result.body.state ? result.body.state : 'unknown';

      return handlerInput.responseBuilder
        .speak(`The TV status is ${state}.`)
        .getResponse();
    } catch (error) {
      return handlerInput.responseBuilder
        .speak('I could not fetch the TV status.')
        .getResponse();
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('You can say things like volume up, go home, pause, or turn on the TV.')
      .reprompt('What would you like me to do?')
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && (
      request.intent.name === 'AMAZON.CancelIntent' ||
      request.intent.name === 'AMAZON.StopIntent'
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Goodbye.')
      .getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('Error handled', error);
    return handlerInput.responseBuilder
      .speak('Sorry, I had trouble handling that request.')
      .getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    TVCommandHandler,
    StatusIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
