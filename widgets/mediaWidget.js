import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';

function unwrap(val) {
    if (val === undefined || val === null) return null;
    let curr = val;
    while (curr && typeof curr.deep_unpack === 'function') curr = curr.deep_unpack();
    if (Array.isArray(curr)) return curr.map(item => unwrap(item));
    return curr;
}

export class MediaWidget {
    constructor(isDark, s = 1.0) {
        this._s = s;
        const txtColor = isDark ? '#F2F2F7' : '#1C1C1E';
        
        this.actor = new St.BoxLayout({ 
            style_class: isDark ? 'pebble-card dark' : 'pebble-card light', 
            vertical: false, 
            x_align: Clutter.ActorAlign.START,
            style: `width: ${360 * s}px; min-width: ${360 * s}px; max-width: ${360 * s}px; padding: ${12 * s}px ${16 * s}px; border-radius: ${28 * s}px; min-height: ${144 * s}px;`,
        });

        this._currentPlayerBus = null;

        // Album Art Box with fallback ♫ icon
        this._art = new St.Bin({ 
            style: `width: ${120 * s}px; height: ${120 * s}px; border-radius: ${16 * s}px; background-color: #2C2C2E;`,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        
        this._fallbackIcon = new St.Label({
            text: '♫',
            style: `font-size: ${50 * s}px; color: #8E8E93;`,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._art.set_child(this._fallbackIcon);
        
        const artWrapper = new St.BoxLayout({ 
            vertical: true, 
            y_align: Clutter.ActorAlign.CENTER, 
            style: `margin-right: ${20 * s}px;`,
        });
        artWrapper.add_child(this._art);

        // Details Column
        const details = new St.BoxLayout({ 
            vertical: true, 
            y_align: Clutter.ActorAlign.CENTER, 
            x_expand: true,
            style: `width: ${188 * s}px;`,
        });

        this._title = new St.Label({ 
            text: 'Not Playing', 
            style: `font-size: ${16 * s}px; font-weight: 700; color: ${txtColor}; margin-bottom: ${4 * s}px;`,
        });
        this._title.clutter_text.line_wrap = true;
        this._title.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_OR_CHAR;
        this._title.clutter_text.ellipsize = Pango.EllipsizeMode.END;

        this._artist = new St.Label({ 
            text: '', 
            style: `font-size: ${13 * s}px; font-weight: 500; color: #636366;`,
        });
        this._artist.clutter_text.ellipsize = Pango.EllipsizeMode.END;

        details.add_child(this._title);
        details.add_child(this._artist);
        
        this.actor.add_child(artWrapper);
        this.actor.add_child(details);

        this._updatePlayer();
        this._timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._updatePlayer();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _updatePlayer() {
        Gio.DBus.session.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'ListNames', new GLib.Variant('()', []), null, Gio.DBusCallFlags.NONE, -1, null, (conn, res) => {
            try {
                const names = conn.call_finish(res).get_child_value(0).get_strv();
                const players = names.filter(n => n.startsWith('org.mpris.MediaPlayer2.'));
                
                if (players.length > 0) {
                    // Pass null initially to start tracking the best available state
                    this._findBestPlayer(players, 0, null);
                } else {
                    this._resetPlayer();
                }
            } catch (_) {}
        });
    }

    _findBestPlayer(players, index, pausedPlayer) {
        // If we checked all apps: Bind to a paused app if one exists, otherwise wipe the card.
        if (index >= players.length) { 
            if (pausedPlayer) this._bindToPlayer(pausedPlayer);
            else this._resetPlayer();
            return; 
        }

        const player = players[index];
        Gio.DBus.session.call(player, '/org/mpris/MediaPlayer2', 'org.freedesktop.DBus.Properties', 'Get', new GLib.Variant('(ss)', ['org.mpris.MediaPlayer2.Player', 'PlaybackStatus']), null, Gio.DBusCallFlags.NONE, -1, null, (c, r) => {
            let status = 'Stopped';
            try {
                status = unwrap(c.call_finish(r).get_child_value(0).get_variant());
            } catch (_) {}

            if (status === 'Playing') {
                // Immediate win: If an app is playing, bind to it and stop searching
                this._bindToPlayer(player);
            } else {
                // Store the first paused app we find as a fallback, then keep searching for a playing one
                if (status === 'Paused' && !pausedPlayer) {
                    pausedPlayer = player;
                }
                this._findBestPlayer(players, index + 1, pausedPlayer);
            }
        });
    }

    _bindToPlayer(player) {
        this._currentPlayerBus = player;
        Gio.DBus.session.call(player, '/org/mpris/MediaPlayer2', 'org.freedesktop.DBus.Properties', 'Get', new GLib.Variant('(ss)', ['org.mpris.MediaPlayer2.Player', 'Metadata']), null, Gio.DBusCallFlags.NONE, -1, null, (c, r) => {
            try {
                const val = c.call_finish(r).get_child_value(0).get_variant().deep_unpack();
                const rawTitle = unwrap(val['xesam:title']);
                const rawArtist = unwrap(val['xesam:artist']);
                const rawArt = unwrap(val['mpris:artUrl']);

                // Safely assign properties with fallbacks so Firefox doesn't crash the widget
                this._title.set_text(rawTitle ? String(rawTitle) : 'Unknown Media');
                this._artist.set_text(rawArtist ? (Array.isArray(rawArtist) ? rawArtist.join(', ') : String(rawArtist)) : '');
                
                if (rawArt) {
                    let artUrl = decodeURI(String(rawArt));
                    if (!artUrl.startsWith('file://') && artUrl.startsWith('/')) artUrl = 'file://' + artUrl;
                    this._art.set_style(`width: ${120 * this._s}px; height: ${120 * this._s}px; border-radius: ${16 * this._s}px; background-image: url("${artUrl}"); background-size: cover; background-position: center;`);
                    this._fallbackIcon.hide(); 
                } else {
                    this._art.set_style(`width: ${120 * this._s}px; height: ${120 * this._s}px; border-radius: ${16 * this._s}px; background-color: #2C2C2E;`);
                    this._fallbackIcon.show(); 
                }
            } catch (_) {
                // If the app completely fails to deliver metadata, show it as unknown instead of crashing
                this._title.set_text('Unknown Media');
                this._artist.set_text('');
                this._art.set_style(`width: ${120 * this._s}px; height: ${120 * this._s}px; border-radius: ${16 * this._s}px; background-color: #2C2C2E;`);
                this._fallbackIcon.show();
            }
        });
    }

    _resetPlayer() {
        this._currentPlayerBus = null;
        this._title.set_text('Not Playing');
        this._artist.set_text('');
        this._art.set_style(`width: ${120 * this._s}px; height: ${120 * this._s}px; border-radius: ${16 * this._s}px; background-color: #2C2C2E;`);
        this._fallbackIcon.show();
    }

    destroy() {
        if (this._timer) GLib.Source.remove(this._timer);
        this.actor.destroy();
    }
}