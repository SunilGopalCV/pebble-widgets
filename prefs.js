import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PebbleWidgetsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        
        const groupWidgets = new Adw.PreferencesGroup({ title: 'Active Widgets' });
        const groupPosition = new Adw.PreferencesGroup({ title: 'Desktop Position' });
        const groupAppearance = new Adw.PreferencesGroup({ title: 'Appearance' });

        // Widget Toggles
        const widgets = [
            { key: 'show-calendar', title: 'Calendar and Agenda Widget' },
            { key: 'show-media', title: 'Now Playing Media Widget' },
            { key: 'show-weather', title: 'Weather Forecast Widget' },
        ];
        for (const w of widgets) {
            const row = new Adw.SwitchRow({ title: w.title });
            settings.bind(w.key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            groupWidgets.add(row);
        }

        // Desktop Coordinates
        const spinX = new Adw.SpinRow({
            title: 'Horizontal Offset (X)',
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 3840, step_increment: 10 }),
        });
        settings.bind('pos-x', spinX, 'value', Gio.SettingsBindFlags.DEFAULT);
        groupPosition.add(spinX);

        const spinY = new Adw.SpinRow({
            title: 'Vertical Offset (Y)',
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 2160, step_increment: 10 }),
        });
        settings.bind('pos-y', spinY, 'value', Gio.SettingsBindFlags.DEFAULT);
        groupPosition.add(spinY);

        // Dark Mode Toggle
        const darkToggle = new Adw.SwitchRow({ title: 'Dark Mode' });
        settings.bind('dark-mode', darkToggle, 'active', Gio.SettingsBindFlags.DEFAULT);
        groupAppearance.add(darkToggle);

        // Opacity Slider (20% - 100%)
        const opacityRow = new Adw.ActionRow({ title: 'Widget Opacity (%)' });
        const scaleOpacity = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 20, 100, 1);
        scaleOpacity.set_hexpand(true);
        scaleOpacity.set_valign(Gtk.Align.CENTER);
        settings.bind('opacity', scaleOpacity.get_adjustment(), 'value', Gio.SettingsBindFlags.DEFAULT);
        opacityRow.add_suffix(scaleOpacity);
        groupAppearance.add(opacityRow);

        // Vector Scale Slider (50% - 200%)
        const scaleRow = new Adw.ActionRow({ title: 'Widget Size (%)' });
        const scaleSize = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 50, 200, 1);
        scaleSize.set_hexpand(true);
        scaleSize.set_valign(Gtk.Align.CENTER);
        settings.bind('widget-scale', scaleSize.get_adjustment(), 'value', Gio.SettingsBindFlags.DEFAULT);
        scaleRow.add_suffix(scaleSize);
        groupAppearance.add(scaleRow);

        page.add(groupWidgets);
        page.add(groupPosition);
        page.add(groupAppearance);
        window.add(page);
    }
}