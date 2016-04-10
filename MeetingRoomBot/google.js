/** Adapted from https://developers.google.com/google-apps/calendar/quickstart/nodejs#step_4_run_the_sample **/
var q = require('kew');

var SETTINGS = require('./settings');

var fs         = require('fs');
var readline   = require('readline');
var google     = require('googleapis');
var googleAuth = require('google-auth-library');

var SCOPES     = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_PATH = 'google-calendar-token.json';

var client_oauth;

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 */
function authorize(credentials) {
    var clientSecret = credentials.installed.client_secret;
    var clientId     = credentials.installed.client_id;
    var redirectUrl  = credentials.installed.redirect_uris[0];
    var auth         = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    if (fs.existsSync(TOKEN_PATH)) {
        oauth2Client.credentials = JSON.parse(fs.readFileSync(TOKEN_PATH));
        client_oauth             = oauth2Client;
    } else {
        getNewToken(oauth2Client);
    }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 */
function getNewToken(oauth2Client) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type : 'offline',
        scope       : SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input  : process.stdin,
        output : process.stdout
    });
    rl.question('Enter the code from that page here: ', function (code) {
        rl.close();
        oauth2Client.getToken(code, function (err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            client_oauth = oauth2Client;
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 */
function listEvents() {
    var deferred = q.defer();
    var calendar = google.calendar('v3');
    calendar.events.list({
        auth         : client_oauth,
        calendarId   : 'primary',
        timeMin      : (new Date()).toISOString(),
        maxResults   : 10,
        singleEvents : true,
        orderBy      : 'startTime'
    }, function (err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var events = response.items;

        var eventsList = [];
        if (events.length == 0) {
            eventsList.push('No upcoming events found.');
        } else {
            for (var i = 0; i < events.length; i++) {
                var event = events[i];
                var start = event.start.dateTime || event.start.date;
                eventsList.push('%s - %s\n' + start + '\n' + event.summary + '\n');
            }
        }

        deferred.resolve('```' + eventsList.join('\n') + '```');
    });

    return deferred;
}

var BOT_MONITORED_MEETING_ROOMS = new RegExp(SETTINGS.GOOGLE_CALENDAR_MEETING_ROOM_NAMES.join('|'), 'i');
var CALENDAR_ID_BY_NAME         = {};

function getCalendarList() {
    var deferred = q.defer();

    google.calendar('v3').calendarList.list({ auth : client_oauth }, function (err, response) {
        if (err) {
            deferred.reject(err);
        } else {
            response.items.forEach(function addCalendarId(cal) {
                if (BOT_MONITORED_MEETING_ROOMS.test(cal.summary)) {
                    CALENDAR_ID_BY_NAME[cal.summary] = cal.id;
                }
            });

            console.log('Retrieved list of Google Calendar ids for meeting rooms.');

            deferred.resolve(CALENDAR_ID_BY_NAME);
        }
    });

    return deferred;
}

function freeBusySingle(meetingRoomName) {
    var deferred = q.defer();

    var today    = new Date();
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);

    google.calendar('v3').freebusy.query({
        auth     : client_oauth,
        resource : {
            timeMin : today.toISOString(),
            timeMax : tomorrow.toISOString(),
            items   : [{ id : CALENDAR_ID_BY_NAME[meetingRoomName] }]
        }
    }, function (err, response) {
        if (err) {
            deferred.reject(err);
        } else {
            var id = Object.keys(response.calendars)[0];
            var busyTimes = response.calendars[id].busy;
            deferred.resolve(busyTimes);
        }
    });

    return deferred;
}

function googleAuthorize() {
    // Load client secrets from a local file.
    fs.readFile('google-client-secret.json', function processClientSecrets(err, content) {
        if (err) {
            console.log('Error loading client secret file: ' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Google Calendar API.
        authorize(JSON.parse(content));
        getCalendarList();
    });
}

module.exports = {
    authorize      : googleAuthorize,
    listEvents     : listEvents,
    freeBusySingle : freeBusySingle
};