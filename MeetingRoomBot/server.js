var SETTINGS = require('./settings');
var slack    = require('./slack');
var google   = require('./google');
var moment   = require('moment');

var MEETING_ROOM_MENTION = /meeting(\s)+room[s]/gi;

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
    'brussels'    : 'Meeting Room Brussels'
};

var ROOM_TRIGGERS = Object.keys(ROOM_NAME_BY_TRIGGER);

function getMentionedRoomCalendarName(text) {
    var lowercaseText = text.toLowerCase();

    var trigger = ROOM_TRIGGERS.filter(function (trigger) {
        return lowercaseText.indexOf(trigger) !== -1;
    });

    return ROOM_NAME_BY_TRIGGER[trigger[0]];
}

function onFreeBusySingle(message, busyTimes) {
    var now = moment(new Date());
    var reply;

    if (busyTimes.length === 0) {
        reply = message.meetingRoom + ' is free for the rest of the day';
    } else {
        for (var i = 0; i < busyTimes.length; i++) {
            var event = busyTimes[i];

            if (now.isBefore(event.start)) {
                reply = message.meetingRoom + ' is *free*. It\'ll be busy again ' + moment(event.start).fromNow() + '.';
                break;
            } else if (now.isBetween(event.start, event.end)) {
                reply = message.meetingRoom + ' is *busy right now*. It\'s free ' + moment(event.end).toNow() + '.';
                break;
            } else if (i === busyTimes.length - 1) {
                reply = message.meetingRoom + ' is *free* for the rest of the day.';
            }
        }
    }

    slack.web.postMessage({
        channel : slack.getChannelNameById(message.channel),
        text    : reply
    });
}

function onChannelMessage(message) {
    var mentionedRoomName = getMentionedRoomCalendarName(message.text);
    if (mentionedRoomName) {
        // Is room name mentioned?
        message.meetingRoom = mentionedRoomName;
        google.freeBusySingle(mentionedRoomName).then(onFreeBusySingle.bind(null, message));
    } else if (MEETING_ROOM_MENTION.test(message.text)) {
        // Is "meeting room" mentioned?
        // todo: check all calendars and find all currently free meeting rooms
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
