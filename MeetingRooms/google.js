/**
 * Queries Google Calendars of the meeting rooms and caches the response with a 10 min lifetime.
 * Adapted from https://developers.google.com/google-apps/calendar/quickstart/nodejs#step_4_run_the_sample
 */

var q      = require('kew');
var moment = require('moment');

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

var freebusyResponseCache   = {};
var freebusyCacheTimestamps = {};

var CACHED_RESPONSE_LIFETIME = 1000 * 60 * 60 * 10; // 10 minutes

function freeBusySingle(meetingRoomName) {
    var deferred = q.defer();

    var cachedResponse  = freebusyResponseCache[meetingRoomName];
    var cachedTimestamp = freebusyCacheTimestamps[meetingRoomName];

    var isCachedResponseExpired = new Date() - cachedTimestamp > CACHED_RESPONSE_LIFETIME;

    if (cachedResponse && !isCachedResponseExpired) {
        deferred.resolve(cachedResponse);

    } else {
        var today    = new Date();
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0);

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
                var id        = Object.keys(response.calendars)[0];
                var busyTimes = response.calendars[id].busy;

                freebusyResponseCache[meetingRoomName]   = busyTimes;
                freebusyCacheTimestamps[meetingRoomName] = +new Date();

                deferred.resolve(busyTimes);
            }
        });
    }

    return deferred;
}

function freeBusyAll() {
    return q.all(SETTINGS.GOOGLE_CALENDAR_MEETING_ROOM_NAMES.map(freeBusySingle));
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
    freeBusySingle : freeBusySingle,
    freeBusyAll    : freeBusyAll
};