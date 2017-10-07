const Lang           = imports.lang;
const Main           = imports.ui.main;
const Mainloop       = imports.mainloop;
const Gtk            = imports.gi.Gtk;
const Shell          = imports.gi.Shell;
const WindowTracker  = Shell.WindowTracker.get_default();
const AppSystem      = Shell.AppSystem.get_default()
const ExtensionUtils = imports.misc.extensionUtils;
const Unite          = ExtensionUtils.getCurrentExtension();
const Helper         = Unite.imports.helperUtils;

const AppMenu = new Lang.Class({
  Name: 'AppMenu',
  _appMenu: null,
  _gtkSettings: null,
  _wmHandlerIDs: [],
  _dsHandlerID: null,
  _asHandlerID: null,
  _wtHandlerID: null,
  _activeApp: null,
  _activeWindow: null,

  _init: function() {
    this._appMenu     = Main.panel.statusArea.appMenu;
    this._gtkSettings = Gtk.Settings.get_default();

    Mainloop.idle_add(Lang.bind(this, this._showMenu));
    Mainloop.idle_add(Lang.bind(this, this._updateMenu));

    this._connectSignals();
  },

  _connectSignals: function () {
    this._dsHandlerID = global.display.connect(
      'notify::focus-window', Lang.bind(this, this._updateMenu)
    );

    this._asHandlerID = AppSystem.connect(
      'app-state-changed', Lang.bind(this, this._showMenu)
    );

    this._wtHandlerID = WindowTracker.connect(
      'notify::focus-app', Lang.bind(this, this._showMenu)
    );

    this._wmHandlerIDs.push(global.window_manager.connect(
      'destroy', Lang.bind(this, this._updateMenu)
    ));

    let sizeSignal = Helper.versionLT('3.24') ? 'size-change' : 'size-changed';

    this._wmHandlerIDs.push(global.window_manager.connect(
      sizeSignal, Lang.bind(this, this._updateMenu)
    ));
  },

  _showMenu: function () {
    let showMenu = this._gtkSettings.gtk_shell_shows_app_menu;

    if (showMenu) {
      if (this._appMenu._nonSensitive) {
        this._appMenu.setSensitive(true);
        this._appMenu._nonSensitive = false;
      }
    } else {
      if (!this._appMenu._visible && this._appMenu._targetApp) {
        this._appMenu.show();
        this._appMenu.setSensitive(false);
        this._appMenu._nonSensitive = true;
      }
    }
  },

  _updateMenu: function () {
    this._activeApp    = WindowTracker.focus_app;
    this._activeWindow = global.display.focus_window;

    if (this._activeWindow && !this._activeWindow._updateTitleID) {
      this._activeWindow._updateTitleID = this._activeWindow.connect(
        'notify::title', Lang.bind(this, this._updateTitle)
      );
    }

    this._updateTitle();
    this._showMenu();
  },

  _updateTitle: function () {
    let title = null;

    if (this._activeWindow && this._activeWindow.get_maximized()) {
      title = this._activeWindow.title;
    }

    if (this._activeApp && !title) {
      title = this._activeApp.get_name();
    }

    if (title) {
      this._appMenu._label.set_text(title);
    }
  },

  destroy: function() {
    let windows = Helper.getAllWindows();

    windows.forEach(function(win) {
      if (win._updateTitleID) {
        win.disconnect(win._updateTitleID);
        win._updateTitleID = null;
      }
    });

    global.display.disconnect(this._dsHandlerID);
    AppSystem.disconnect(this._asHandlerID);
    WindowTracker.disconnect(this._wtHandlerID);

    this._wmHandlerIDs.forEach(function (handler) {
      global.window_manager.disconnect(handler);
    });

    Mainloop.idle_add(Lang.bind(this, this._showMenu));
  }
});
