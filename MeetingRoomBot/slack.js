/**
 * Encapsulated logic for doing things with the Slack APIs.
 * We have both RTM and Web clients at our disposal.
 */

var fs = require('fs');
var q  = require('kew');

var RtmClient = require('@slack/client').RtmClient;
var WebClient = require('@slack/client').WebClient;

var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_EVENTS    = require('@slack/client').RTM_EVENTS;

/** Client instances **/
var rtm;
var web;

/** Fails within timeout if no connection was made successfully */
var RTM_CONNECT_TIMEOUT = 15000;

/** Bot instance settings */
var BOT_NAME;
var BOT_AVATAR_URL;
var BOT_MONITORED_CHANNELS;

/** Dictionaries to translate between id and human readable names **/
var CHANNEL_ID_TO_NAME = {};
var CHANNEL_NAME_TO_ID = {};

/**
 * @param {object}      response
 * @param {object[]}    response.channels
 */
function onChannelsList(response) {
    response.channels.forEach(function (channel) {
        CHANNEL_ID_TO_NAME[channel.id]   = channel.name;
        CHANNEL_NAME_TO_ID[channel.name] = channel.id;
    });
    console.log('Received list of channels.')
}

function populateChannelsDict() {
    return web.channels.list().then(onChannelsList);
}

/** Dictionary for id to human readable user name **/
var USER_ID_TO_NAME = {};

/**
 * @param {object}      response
 * @param {object[]}    response.members
 */
function onUsersList(response) {
    response.members
        .filter(function isNotDeleted(user) { return !user.deleted; })
        .forEach(function (user) {
            USER_ID_TO_NAME[user.id] = user.name;
        });
    console.log('Received list of users.');
}

function populateUsersDict() {
    return web.users.list().then(onUsersList);
}

/**
 * @param {string} username
 * @param {string[]} [channels]
 * @returns {!Promise}
 */
function connect(username, channels, icon_url) {
    var deferred = q.defer();
    var connectionTimeout;

    var token = JSON.parse(fs.readFileSync('slack-client-secret.json')).SLACK_TOKEN;

    rtm = new RtmClient(token); //, { logLevel : 'debug' }
    web = new WebClient(token); //, { logLevel : 'debug' }

    connectionTimeout = setTimeout(deferred.reject.bind(deferred), RTM_CONNECT_TIMEOUT);

    rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function onRTMConnectionOpen() {
        console.log('Connected to Slack as via RTM API.');
        clearTimeout(connectionTimeout);

        // Wait for Slack to send us all the model data
        q.all([
            populateChannelsDict(),
            populateUsersDict()
        ]).then(deferred.resolve.bind(deferred));

    });

    rtm.start();

    BOT_NAME = username;

    channels               = channels || [];
    BOT_MONITORED_CHANNELS = new RegExp(channels.join('|'), 'i');

    BOT_AVATAR_URL = icon_url || '';

    return deferred;
}

/**
 * Assign a handler to listen to all non-self messages on actively monitored channels.
 * @param {function} onRTMMessage
 */
function listen(onRTMMessage) {
    rtm.on(RTM_EVENTS.MESSAGE, function (message) {
        var isFromMonitoredChannel = BOT_MONITORED_CHANNELS.test(CHANNEL_ID_TO_NAME[message.channel]);

        if (isFromMonitoredChannel && message.username !== BOT_NAME) {
            onRTMMessage(message);
        }
    });
}

// Web client methods
// Source / docs https://github.com/slackhq/node-slack-client/blob/master/lib/clients/web

function WEBchatPostMessage(args) {
    args.opts = {
        username : BOT_NAME,
        icon_url : BOT_AVATAR_URL
    };
    return web.makeAPICall('chat.postMessage', args);
}

function getChannelNameById(id) {
    return CHANNEL_ID_TO_NAME[id];
}

module.exports = {
    getChannelNameById : getChannelNameById,
    connect            : connect,
    listen             : listen,
    web                : {
        postMessage : WEBchatPostMessage
    }
};