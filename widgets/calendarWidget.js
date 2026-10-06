import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class CalendarWidget {
    constructor(isDark, s = 1.0) {
        this._isDark = isDark;
        
        this.actor = new St.BoxLayout({
            style_class: isDark ? 'pebble-card dark' : 'pebble-card light',
            vertical: false,
            reactive: true,
            style: `border-radius: ${28 * s}px; padding: ${14 * s}px;`,
        });

        // Left Pill: Next Upcoming Event
        const eventCard = new St.BoxLayout({ 
            vertical: true,
            style: `padding: ${16 * s}px; min-width: ${170 * s}px; min-height: ${160 * s}px; border-radius: ${20 * s}px; background-color: #1C1C1E;`,
        });
        
        eventCard.add_child(new St.Label({
            text: 'Next event:',
            style: `font-size: ${11 * s}px; color: #8E8E93;`,
        }));
        
        this._eventTitle = new St.Label({
            text: 'No Upcoming\nEvents',
            style: `font-size: ${17 * s}px; font-weight: 700; color: #FFFFFF;`,
        });
        this._eventTime = new St.Label({
            text: '--:--',
            style: `font-size: ${15 * s}px; font-weight: 600; color: #FFFFFF;`,
        });
        
        eventCard.add_child(this._eventTitle);
        const timeBox = new St.BoxLayout({ vertical: false, style: `margin-top: ${14 * s}px;` });
        timeBox.add_child(new St.Label({
            text: 'Time:\n',
            style: `font-size: ${15 * s}px; font-weight: 600; color: #FFFFFF;`,
        }));
        timeBox.add_child(this._eventTime);
        eventCard.add_child(timeBox);
        this.actor.add_child(eventCard);

        this._buildGrid(s);

        // Bind directly to GNOME's active calendar backend
        const dateMenu = Main.panel.statusArea.dateMenu;
        this._eventSource = dateMenu?._eventsItem ? dateMenu._eventsItem._eventSource : dateMenu?._eventSource;

        if (this._eventSource) {
            this._changedId = this._eventSource.connect('changed', this._fetchRealEvents.bind(this));
            this._fetchRealEvents();
        }
    }

    _fetchRealEvents() {
        if (!this._eventSource) return;
        try {
            const now = new Date();
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            const events = this._eventSource.getEvents(now, endOfDay);
            if (events && events.length > 0) {
                const summary = events[0].summary || 'Event';
                this._eventTitle.set_text(summary.length > 20 ? `${summary.substring(0, 20)}...` : summary);
                this._eventTime.set_text(events[0].date ? events[0].date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--');
            } else {
                this._eventTitle.set_text('No Upcoming\nEvents');
                this._eventTime.set_text('--:--');
            }
        } catch (_) {}
    }

    _buildGrid(s) {
        const gridBox = new St.BoxLayout({ vertical: true, style: `padding-left: ${18 * s}px;` });
        const daysRow = new St.BoxLayout({ vertical: false });
        
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
            const headBin = new St.Bin({
                style: `min-width: ${30 * s}px; min-height: ${28 * s}px;`,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            headBin.set_child(new St.Label({
                text: d,
                style: `font-size: ${13 * s}px; font-weight: bold; color: #8E8E93;`,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            }));
            daysRow.add_child(headBin);
        });
        gridBox.add_child(daysRow);

        const date = new Date();
        const currentDay = date.getDate();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

        let dayCounter = 1;
        const txtColor = this._isDark ? '#F2F2F7' : '#1C1C1E';

        for (let w = 0; w < 6; w++) {
            const row = new St.BoxLayout({ vertical: false });
            for (let d = 0; d < 7; d++) {
                let text = '';
                let isCurrent = false;

                if (w === 0 && d < firstDay) {
                    text = '';
                } else if (dayCounter <= daysInMonth) {
                    text = `${dayCounter}`;
                    isCurrent = (dayCounter === currentDay);
                    dayCounter++;
                }

                const cellBin = new St.Bin({
                    style: `min-width: ${30 * s}px; min-height: ${30 * s}px;` + 
                           (isCurrent ? `background-color: #FF3B30; border-radius: ${15 * s}px;` : ''),
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                });

                const dayLabel = new St.Label({
                    text: text,
                    style: `font-size: ${14 * s}px; font-weight: ${isCurrent ? 'bold' : '500'}; color: ${isCurrent ? '#FFFFFF' : txtColor};`,
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                });

                cellBin.set_child(dayLabel);
                row.add_child(cellBin);
            }
            gridBox.add_child(row);
            if (dayCounter > daysInMonth) break;
        }
        this.actor.add_child(gridBox);
    }

    destroy() {
        if (this._eventSource && this._changedId) {
            this._eventSource.disconnect(this._changedId);
            this._changedId = null;
        }
        this.actor.destroy();
    }
}