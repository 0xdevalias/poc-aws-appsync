# PoC-AWS-AppSync

PoC playing with [AWS AppSync](https://aws.amazon.com/appsync/) and [GraphQL subscriptions](https://docs.aws.amazon.com/appsync/latest/devguide/real-time-data.html) (websockets, mqtt, etc) in [React](https://github.com/facebook/create-react-app).

## GraphQL Schema, ..TODO:etc..

TODO: how to set up in AWS

* https://docs.aws.amazon.com/appsync/latest/devguide/designing-a-graphql-api.html
* https://docs.aws.amazon.com/appsync/latest/devguide/real-time-data.html
* https://docs.aws.amazon.com/appsync/latest/devguide/tutorial-local-resolvers.html
* https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference.html

## React

First step, we need to create a new React application. This is super easy..

```
mkdir poc-aws-appsync && cd poc-aws-appsync
npm init react-app .
```

## Amplify (the manual way)

Next, we're going to make use of [AmplifyJS](https://github.com/aws-amplify/amplify-js) and it's React components to [simplify wiring AppSync into our frontend](https://aws-amplify.github.io/amplify-js/media/api_guide#using-aws-appsync).

You might want to [look at the AppSync React starter project](https://github.com/aws-samples/aws-mobile-appsync-events-starter-react) as a reference (and for better project layout/code style than this PoC).

First we want to install some dependencies:

* `@aws-amplify/core`: Pull all the modularised features together
* `@aws-amplify/api`: GraphQL API support
* `@aws-amplify/pubsub`: GraphQL subscription support
* `aws-amplify-react` : React components

```
npm install @aws-amplify/core @aws-amplify/api @aws-amplify/pubsub aws-amplify-react
```

Next we need to wire them into our React app. Something that wasn't immediately obvious to me was [how to use the modularised dependencies](https://github.com/aws-amplify/amplify-js/wiki/Amplify-modularization#dependencies). It seems that we can just import core, and then import the other modules we want, and it appears to magically wire itself together. For example:

Bad:
```javascript
import Amplify from '@aws-amplify/core';
//import API, {graphqlOperation} from '@aws-amplify/api'

console.log("Automagicly Wired?", Amplify.API !== null); // false
```

Good:
```javascript
import Amplify from '@aws-amplify/core';
import API, {graphqlOperation} from '@aws-amplify/api'

console.log("Automagicly Wired?", Amplify.API !== null); // true
```

Even though it seems to automagically work, we get 'unused var' errors for the other imports.. so it seems we can be a little more explicit to resolve this:

```javascript
import Amplify from '@aws-amplify/core';
import API, {graphqlOperation} from '@aws-amplify/api'

Amplify.register(API);

console.log("Automagicly Wired?", Amplify.API !== null); // true
```

For the next part you will need to grab a few settings from the aptly named 'Settings' page in your project within the AWS AppSync Console. You could use the 'Download Config' button, or copy the relevant bits manually.

Alternatively, you could grab them with the [AWS AppSync CLI](https://docs.aws.amazon.com/cli/latest/reference/appsync/index.html):

* [`list-api-keys`](https://docs.aws.amazon.com/cli/latest/reference/appsync/list-api-keys.html): Will show you all of your API's (and the most of the details you'll need for config)
* [`get-graphql-api`](https://docs.aws.amazon.com/cli/latest/reference/appsync/get-graphql-api.html): If you already know your apiID, you can get the details directly
* [`list-api-keys`](https://docs.aws.amazon.com/cli/latest/reference/appsync/list-api-keys.html)

```
# List all API's
aws appsync list-graphql-apis

# Get specific API
aws appsync get-graphql-api --api-id ABC123MYAPIID

# Lookup API keys for API
aws appsync list-api-keys --api-id ABC123MYAPIID
```

Settings:

* `aws_appsync_graphqlEndpoint`: The value in `uris.GRAPHQL`
* `aws_appsync_region`: You can get this from `uris.GRAPHQL`, the part just before `.amazonaws.com`. Eg. `ap-southeast-2`
* `aws_appsync_authenticationType`: The value in `authenticationType`
* `aws_appsync_apiKey`: The value in `apiKeys[].id`

Since we're using `API_KEY` auth for our API here, we need to [configure our app appropriately](https://aws-amplify.github.io/amplify-js/media/api_guide#using-api_key).:

`index.js`:
```javascript
//..snip..

import Amplify from '@aws-amplify/core';
import API, {graphqlOperation} from '@aws-amplify/api'
import PubSub from '@aws-amplify/pubsub';

Amplify.register(API);
Amplify.register(PubSub);

const aws_config = {
  'aws_appsync_graphqlEndpoint': 'https://xxxxxx.appsync-api.us-east-1.amazonaws.com/graphql',
  'aws_appsync_region': 'us-east-1',
  'aws_appsync_authenticationType': 'API_KEY',
  'aws_appsync_apiKey': 'da2-xxxxxxxxxxxxxxxxxxxxxxxxxx',
};

Amplify.API.configure(aws_config);

//..snip..
```

Now that we've wired in our authentication, we want to [test our subscriptions](https://aws-amplify.github.io/amplify-js/media/api_guide#subscriptions). We can hack this in and output anything received to the console by adding the following code just after our `Amplify.configure(aws_config)` line. We'll also manually hack in a mutation that we should hopefully see on the subscription:

`index.js`:
```javascript
//..snip..

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

//..snip..
```

We can then start our app (`npm start`) and check for the console output, which should look something like the following (when not expanded):

```
Mutation: {data: {…}}
Subscription: {provider: AWSAppSyncProvider, value: {…}} {receivedCommand: {…}}
```

Now a potential issue you may run into with your own subscriptions is the strange requirements around the shape of both the mutation, and the subscription when using `@aws_subscribe`. As [alluded to in this post](https://medium.com/@st3f4n.s/subscriptions-for-react-native-with-appsync-and-lambda-resolvers-d53349a0755b), if we have a parameter that is not included in the selection set of our mutation, it will just silently not fire.

For example, in my testing, this didn't work:

```javascript
const SendCommand = `mutation sendCommand($channelID: ID!, $command: String!) {
  sendCommand(channelID: $channelID, command: $command) {
    sentAt
  }
}`;

const SubscribeToChannelCommands = `subscription SubscribeToChannelCommands($channelID: ID!) {
  receivedCommand(channelID: $channelID) {
    command
    sentAt
  }
}`;
```

Whereas when I changed the shape of the mutation to the following, I started seeing my subscription being fired:

```javascript
const SendCommand = `mutation sendCommand($channelID: ID!, $command: String!) {
  sendCommand(channelID: $channelID, command: $command) {
    channelID
    command
    sentAt
  }
}`;

const SubscribeToChannelCommands = `subscription SubscribeToChannelCommands($channelID: ID!) {
  receivedCommand(channelID: $channelID) {
    channelID
    command
    sentAt
  }
}`;
```

While it is [alluded to in the documentation](https://docs.aws.amazon.com/appsync/latest/devguide/real-time-data.html) (rather unclearly IMO), it doesn't really make sense to me why the selection set inside the subscription appears to be entirely ignored, and the selection set in the mutation is what actually matters/is returned..

> Subscriptions are triggered from mutations and the mutation selection set is sent to subscribers.
> ..snip..
> Although the subscription query above is needed for client connections and tooling, the **selection set that is received by subscribers is specified by the client triggering the mutation.**
> ..snip..
> The return type of a subscription field in your schema must match the return type of the corresponding mutation field.

Perhaps it's because we can subscribe to multiple mutations, and if we were controlling the selection set on the subscription side.. we wouldn't be able to define the shape?

In any case.. we should probably ensure both of these match so that other clients/libraries/frameworks that look at the subscription selection set don't get themselves confused.

Now that you have a basic hacked together test bed, you might want to wire things into react 'properly':

* https://aws-amplify.github.io/amplify-js/media/api_guide#react-components

## TODO: Amplify (the easy way, CLI)

Looking at our AWS AppSync Console, the root page for our project actually gives us some easy commands to inject support into our application (if we're using the [Amplify CLI](https://github.com/aws-amplify/amplify-cli))

TODO

```
amplify add codegen --apiId ABC123YOURAPPSYNCAPIID
```

## Infrastructure as Code (CloudFormation, CDK, etc)

Playing with web UI's is nice for learning, but at the end of the day we want everything tracked and comitted in git, defined and re-deployable.

**CloudFormation**

* [`AWS::AppSync::GraphQLApi`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-appsync-graphqlapi.html)
* [`AWS::AppSync::ApiKey`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-appsync-apikey.html)
* [`AWS::AppSync::GraphQLSchema`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-appsync-graphqlschema.html)
* [`AWS::AppSync::DataSource`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-appsync-datasource.html)
* [`AWS::AppSync::Resolver`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-appsync-resolver.html)

**AWS Cloud Development Kit (CDK)**

* https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html
  * [ApiKeyResource](https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html#apikeyresource)
  * [ApiKeyResourceProps](https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html#apikeyresourceprops-interface)
  * [DataSourceResource](https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html#datasourceresource)
  * [DataSourceResourceProps](https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html#datasourceresourceprops-interface)
  * [GraphQLApiResource](https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html#graphqlapiresource)
  * [GraphQLApiResourceProps](https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html#graphqlapiresourceprops-interface)
  * [GraphQLSchemaResource](https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html#graphqlschemaresource)
  * [GraphQLSchemaResourceProps](https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html#graphqlschemaresourceprops-interface)
  * [ResolverResource](https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html#resolverresource)
  * [ResolverResourceProps](https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-appsync.html#resolverresourceprops-interface)

**AWS Serverless Application Model (SAM)**

* Not currently supported
  * https://github.com/awslabs/serverless-application-model/issues/354
