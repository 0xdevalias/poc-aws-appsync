import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

import Amplify from '@aws-amplify/core';
import API, {graphqlOperation} from '@aws-amplify/api'
import PubSub from '@aws-amplify/pubsub';

// console.log("Automagicly Wired?", Amplify.API !== null);

// Not 100% if we need to do this.. but it seems to get rid of the unused variable errors..
Amplify.register(API);
Amplify.register(PubSub);

const aws_config = {
  'aws_appsync_graphqlEndpoint': 'https://xxxxxx.appsync-api.us-east-1.amazonaws.com/graphql',
  'aws_appsync_region': 'us-east-1',
  'aws_appsync_authenticationType': 'API_KEY',
  'aws_appsync_apiKey': 'da2-xxxxxxxxxxxxxxxxxxxxxxxxxx',
};

Amplify.configure(aws_config);

// Configure our mutation
const SendCommand = `mutation SendCommand($channelID: ID!, $command: String!) {
  sendCommand(channelID: $channelID, command: $command) {
    channelID
    command
    sentAt
  }
}`;

// Configure our subscription
const SubscribeToChannelCommands = `subscription SubscribeToChannelCommands($channelID: ID!) {
  receivedCommand(channelID: $channelID) {
    channelID
    command
    sentAt
  }
}`;

// Subscribe to channel
const subscription = Amplify.API.graphql(
  graphqlOperation(SubscribeToChannelCommands, { channelID: 'abc123' })
).subscribe({
  next: (eventData) => console.log("Subscription:", eventData, eventData.value.data),
  error: (eventData) => console.log("Subscription error:", eventData)
});

// Send mutation after a short delay
setTimeout(function(){
  const sendCommand = Amplify.API.graphql(
    graphqlOperation(SendCommand, { channelID: 'abc123', command: "FOOCOMMAND"})
  ).then(
    (result) => console.log("Mutation:", result),
    (error) => console.log("Mutation error:", error)
  );
}, 1000);

// Stop receiving data updates from the subscription
//subscription.unsubscribe();

ReactDOM.render(<App />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
