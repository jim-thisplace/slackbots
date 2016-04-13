var SETTINGS = require('./settings');
var slack    = require('./slack');
var google   = require('./google');
var moment   = require('moment');

// todo : stuff this into the general disposition module (along with sentiment analysis + message patterns)
/**
 * Bot : << some useful info here >>
 * Jim : nice one!
 * Bot : Thanks
 */
var ACKNOWLEDGE = [
    'Thanks',
    'Cheers',
    ':)',
    ';)',
    'You bet!',
    'Totally',
    'Oh definitely',
    'yep yep'
];

function getRandomAcknowledgement() {
    return ACKNOWLEDGE[Math.floor(Math.random() * ACKNOWLEDGE.length)];
}

var MEETING_ROOM_MENTION = /(any|which|what)*.*(( meeting )*room(s)*|one(s)*)([\w ]+)*free(\?)*/gi;

var ROOM_NAME_BY_TRIGGER = {
    'downtown'    : 'Down Town',
    'first floor' : 'Down Town',
    '1st floor'   : 'Down Town',
    'third floor' : 'Meeting Room 3rd Floor',
    '3rd floor'   : 'Meeting Room 3rd Floor',
    'floor 3'     : 'Meeting Room 3rd Floor',
    'floor three' : 'Meeting Room 3rd Floor',
    'top floor'   : 'Meeting Room 3rd Floor',
    'tokyo'       : 'Meeting Room Tokyo',
    'brussels'    : 'Meeting Room Brussels',
    'seattle'     : 'Meeting Room Seattle'
};

var ROOM_TRIGGERS = Object.keys(ROOM_NAME_BY_TRIGGER);

function getMentionedRoomCalendarName(text) {
    var lowercaseText = text.toLowerCase();

    var trigger = ROOM_TRIGGERS.filter(function (trigger) {
        return lowercaseText.indexOf(trigger) !== -1;
    });

    return ROOM_NAME_BY_TRIGGER[trigger[0]];
}

var EMOJI = {
    FREE : ':white_check_mark:',
    BUSY : ':no_entry:'
};

function getHumanReadableFreeBusyStatus(meetingRoomName, busyTimes) {
    var now = moment();

    // Default is no busy times currently in calendar
    var text = [
        EMOJI.FREE,
        meetingRoomName,
        'is *free* for the rest of the day, so far.'
    ].join(' ');

    for (var i = 0; i < busyTimes.length; i++) {
        var event = busyTimes[i];

        if (now.isBefore(event.start)) {
            text = [
                EMOJI.FREE,
                meetingRoomName,
                'is *free*. It\'ll be busy again',
                moment(event.start).fromNow() + '.'
            ].join(' ');
            break;

        } else if (now.isBetween(event.start, event.end)) {
            text = [
                EMOJI.BUSY,
                meetingRoomName,
                'is *busy right now*. It\'s free',
                moment(event.end).fromNow() + '.'
            ].join(' ');
            break;
        }
    }

    return text;
}

function onFreeBusySingle(message, busyTimes) {
    slack.web.postMessage({
        channel : slack.getChannelNameById(message.channel),
        text    : getHumanReadableFreeBusyStatus(message.meetingRoomName, busyTimes)
    });
}

function onFreeBusyAll(message, busyTimesAll) {
    var text = [];

    for (var i = 0; i < busyTimesAll.length; i++) {
        var name = SETTINGS.GOOGLE_CALENDAR_MEETING_ROOM_NAMES[i];
        text.push(getHumanReadableFreeBusyStatus(name, busyTimesAll[i]));
    }

    slack.web.postMessage({
        channel : slack.getChannelNameById(message.channel),
        text    : text.join('\n\n')
    });
}

function onChannelMessage(message) {
    var mentionedRoomName = getMentionedRoomCalendarName(message.text);
    if (mentionedRoomName) {
        // Is room name mentioned?
        message.meetingRoomName = mentionedRoomName;
        google.freeBusySingle(mentionedRoomName).then(onFreeBusySingle.bind(null, message));
    } else if (MEETING_ROOM_MENTION.test(message.text)) {
        // "Are any meeting rooms free?"
        google.freeBusyAll()
            .then(onFreeBusyAll.bind(null, message));
    }
}

// Connect to Slack and react to inquiries about meeting rooms
slack
    .connect(
        SETTINGS.SLACK_BOT_NAME,
        SETTINGS.SLACK_CHANNELS,
        SETTINGS.SLACK_BOT_AVATAR_URL
    )
    .then(function onConnect() {
        slack.listen(onChannelMessage);
        google.authorize();
    });
