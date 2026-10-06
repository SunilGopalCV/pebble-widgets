import St from 'gi://St';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { CalendarWidget } from './widgets/calendarWidget.js';
import { MediaWidget } from './widgets/mediaWidget.js';
import { WeatherWidget } from './widgets/weatherWidget.js';

export default class PebbleWidgetsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        
        this._container = new St.BoxLayout({
            style_class: 'pebble-widget-container',
            vertical: true,
            reactive: true,
            x: this._settings.get_int('pos-x'),
            y: this._settings.get_int('pos-y'),
        });

        this._widgets = {};
        this._scaleTimeout = null;

        // Position coordinates
        this._posIdX = this._settings.connect('changed::pos-x', () => {
            if (this._container) this._container.set_x(this._settings.get_int('pos-x'));
        });
        this._posIdY = this._settings.connect('changed::pos-y', () => {
            if (this._container) this._container.set_y(this._settings.get_int('pos-y'));
        });

        // Widget visibility toggles
        this._calId = this._settings.connect('changed::show-calendar', () => this._syncWidgets());
        this._mediaId = this._settings.connect('changed::show-media', () => this._syncWidgets());
        this._weatherId = this._settings.connect('changed::show-weather', () => this._syncWidgets());

        // Appearance settings
        this._themeId = this._settings.connect('changed::dark-mode', () => this._syncWidgets());
        this._opacityId = this._settings.connect('changed::opacity', () => this._updateOpacity());
        this._scaleId = this._settings.connect('changed::widget-scale', () => this._debouncedSync());

        // Render behind standard desktop windows
        Main.layoutManager._backgroundGroup.add_child(this._container);

        this._syncWidgets();
        this._updateOpacity();
    }

    _updateOpacity() {
        if (!this._container) return;
        const opacityPct = this._settings.get_int('opacity');
        const alpha = Math.floor((opacityPct / 100) * 255);
        this._container.set_opacity(alpha);
    }

    _debouncedSync() {
        if (this._scaleTimeout) {
            GLib.Source.remove(this._scaleTimeout);
        }
        // Prevents jitter while dragging the scale slider
        this._scaleTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            this._syncWidgets();
            this._scaleTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _syncWidgets() {
        if (!this._container) return;

        if (this._widgets.cal) { this._widgets.cal.destroy(); delete this._widgets.cal; }
        if (this._widgets.media) { this._widgets.media.destroy(); delete this._widgets.media; }
        if (this._widgets.weather) { this._widgets.weather.destroy(); delete this._widgets.weather; }

        this._container.destroy_all_children();

        const isDark = this._settings.get_boolean('dark-mode');
        const scale = this._settings.get_int('widget-scale') / 100.0;

        if (this._settings.get_boolean('show-calendar')) {
            this._widgets.cal = new CalendarWidget(isDark, scale);
            this._container.add_child(this._widgets.cal.actor);
        }
        if (this._settings.get_boolean('show-media')) {
            this._widgets.media = new MediaWidget(isDark, scale);
            this._container.add_child(this._widgets.media.actor);
        }
        if (this._settings.get_boolean('show-weather')) {
            this._widgets.weather = new WeatherWidget(isDark, scale);
            this._container.add_child(this._widgets.weather.actor);
        }
    }

    disable() {
        if (this._scaleTimeout) {
            GLib.Source.remove(this._scaleTimeout);
            this._scaleTimeout = null;
        }

        if (this._settings) {
            this._settings.disconnect(this._posIdX);
            this._settings.disconnect(this._posIdY);
            this._settings.disconnect(this._calId);
            this._settings.disconnect(this._mediaId);
            this._settings.disconnect(this._weatherId);
            this._settings.disconnect(this._themeId);
            this._settings.disconnect(this._opacityId);
            this._settings.disconnect(this._scaleId);
            this._settings = null;
        }

        if (this._widgets.cal) this._widgets.cal.destroy();
        if (this._widgets.media) this._widgets.media.destroy();
        if (this._widgets.weather) this._widgets.weather.destroy();
        this._widgets = {};

        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
    }
}