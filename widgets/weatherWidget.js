import St from 'gi://St';
import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

export class WeatherWidget {
    constructor(isDark, s = 1.0) {
        const txtColor = isDark ? '#F2F2F7' : '#1C1C1E';
        
        this.actor = new St.BoxLayout({ 
            style_class: isDark ? 'pebble-card dark' : 'pebble-card light', 
            vertical: false, 
            x_align: Clutter.ActorAlign.START,
            style: `width: ${160 * s}px; min-width: ${160 * s}px; max-width: ${160 * s}px; padding: ${14 * s}px ${10 * s}px; border-radius: ${28 * s}px;`,
        });

        const centerWrapper = new St.BoxLayout({
            vertical: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });
        
        const iconBox = new St.Bin({ 
            style: `background-color: #1C1C1E; border-radius: ${16 * s}px; width: ${56 * s}px; height: ${56 * s}px;`, 
            x_align: Clutter.ActorAlign.CENTER, 
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._icon = new St.Label({ text: '⛅', style: `font-size: ${28 * s}px;` });
        iconBox.set_child(this._icon);

        const detailsBox = new St.BoxLayout({ 
            vertical: true, 
            style: `margin-left: ${12 * s}px;`, 
            y_align: Clutter.ActorAlign.CENTER,
        });
        
        this._city = new St.Label({ 
            text: 'Locating...', 
            style: `font-size: ${14 * s}px; font-weight: 700; color: ${txtColor}; margin-bottom: ${2 * s}px;`,
        });
        this._currentTemp = new St.Label({ 
            text: '--°C', 
            style: `font-size: ${22 * s}px; font-weight: 800; color: ${txtColor}; margin-bottom: ${2 * s}px; line-height: 1.0;`,
        });
        
        const minMaxBox = new St.BoxLayout({ vertical: false });
        this._maxTemp = new St.Label({ text: '↑--°', style: `font-size: ${11 * s}px; font-weight: 600; color: #636366;` });
        this._minTemp = new St.Label({ text: '↓--°', style: `font-size: ${11 * s}px; font-weight: 600; color: #636366; margin-left: ${8 * s}px;` });
        minMaxBox.add_child(this._maxTemp);
        minMaxBox.add_child(this._minTemp);
        
        detailsBox.add_child(this._city);
        detailsBox.add_child(this._currentTemp);
        detailsBox.add_child(minMaxBox);
        
        centerWrapper.add_child(iconBox);
        centerWrapper.add_child(detailsBox);
        
        this.actor.add_child(centerWrapper);

        this._session = new Soup.Session();
        this._autoLocateAndFetch();
    }

    _autoLocateAndFetch() {
        const msg = Soup.Message.new('GET', 'https://get.geojs.io/v1/ip/geo.json');
        this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (session, res) => {
            try {
                const bytes = session.send_and_read_finish(res);
                const geo = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                this._city.set_text(geo.city || 'Weather');
                this._fetchWeather(geo.latitude, geo.longitude);
            } catch (_) { this._city.set_text('Offline'); }
        });
    }

    _fetchWeather(lat, lon) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
        const msg = Soup.Message.new('GET', url);
        this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (session, res) => {
            try {
                const bytes = session.send_and_read_finish(res);
                const data = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                const temp = Math.round(data.current.temperature_2m);
                const high = Math.round(data.daily.temperature_2m_max[0]);
                const low = Math.round(data.daily.temperature_2m_min[0]);
                
                this._currentTemp.set_text(`${temp}°C`);
                this._maxTemp.set_text(`↑${high}°`);
                this._minTemp.set_text(`↓${low}°`);
                this._icon.set_text(this._getWeatherEmoji(data.current.weather_code));
            } catch (_) {}
        });
    }

    _getWeatherEmoji(code) {
        if (code === 0) return '☀️';
        if (code === 1 || code === 2 || code === 3) return '⛅';
        if (code === 45 || code === 48) return '🌫️';
        if (code === 51 || code === 53 || code === 55) return '🌦️';
        if (code === 61 || code === 63 || code === 65) return '🌧️';
        if (code === 71 || code === 73 || code === 75) return '🌨️';
        if (code === 95 || code === 96 || code === 99) return '⛈️';
        return '☁️';
    }

    destroy() { this.actor.destroy(); }
}