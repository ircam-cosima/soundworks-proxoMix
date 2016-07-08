import {
  Service,
  serviceManager
} from 'soundworks/client';

/* based on cordova-plugin-ibeacon: https://github.com/petermetz/cordova-plugin-ibeacon.git */
const SERVICE_ID = 'service:beacon';

const CORDOVA_PLUGIN_NAME = 'com.unarin.cordova.beacon';
const CORDOVA_PLUGIN_ASSERTED_VERSION = '3.3.0';
const CORDOVA_PLUGIN_REPOSITORY = 'https://github.com/petermetz/cordova-plugin-ibeacon.git';

class Beacon extends Service {
  /** _<span class="warning">__WARNING__</span> This class should never be instanciated manually_ */
  constructor() {
    super(SERVICE_ID, false); // false: does not need netwok connection

    const defaults = {
      uuid: '74278BDA-B644-4520-8F0C-720EAF059935',
    };

    this.configure(defaults);

    // local attributes
    this._beaconData = {};
    this._callbacks = new Set();
    this._cordovaPluginInstalled = false;

    // bind local methods
    this._startAdvertising = this._startAdvertising.bind(this);
    this._stopAdvertising = this._stopAdvertising.bind(this);
    this._startRanging = this._startRanging.bind(this);
    this._stopRanging = this._stopRanging.bind(this);
    this._didRangeBeaconsInRegion = this._didRangeBeaconsInRegion.bind(this);
    this._checkPlugin = this._checkPlugin.bind(this);

  }

  /** @private */
  init() {

    /**
     * - uuid represent the beacon region. a given ranging callback can obly monitor
     * beacons with the same uuid, hence uuid in the soundwork beacon service is hardcoded.
     * - identifier came with the cordova-plugin-ibeacon API, no real cues why it's there.
     * - major / minor: each encoded on 16 bits, these values are to be used to defined a
     * unique soundwork client.
     */
    this._beaconData = {
      uuid: this.options.uuid,
      identifier: 'advertisedBeacon',
      major: Math.floor(Math.random() * 65500),
      minor: Math.floor(Math.random() * 65500)
    }

    document.addEventListener("deviceready", () => {
      // awaits cordova fully loaded (plugins most of all) and check if plugin deps installed to start service

      this._checkPlugin();

      this._startAdvertising();
      this._startRanging();
    }, false);
  }

  /** @private */
  start() {
    super.start();

    if (!this.hasStarted)
      this.init();

    this.ready();
  }

  /** @private
  /*  automatically called with this.ready()
  */
  stop() {
    super.stop();
  }

  /**
   * Register a function that will be invokedwhen neighboring ibeacon list is updated
   * (i.e. every nth millisec. once a single beacon is registered)
   * @param {Function} callback
   */
  addListener(callback) {
    this._callbacks.add(callback);
  }

  /**
  * remove registered callback from stack (see "addCallback")
  */
  removeListener(callback) {
    if (this._callbacks.has(callback)) {
      this._callbacks.delete(callback);
    }
  }

  /** @private */
  _startAdvertising() {

    if (this._cordovaPluginInstalled){

      // define beacon parameters
      var uuid = this._beaconData.uuid;
      var identifier = this._beaconData.identifier;
      var minor = this._beaconData.minor;
      var major = this._beaconData.major;
      var beaconRegion = new cordova.plugins.locationManager.BeaconRegion(identifier, uuid, major, minor);

      // verify the platform supports transmitting as a beacon
      cordova.plugins.locationManager.isAdvertisingAvailable()
        .then(function(isSupported) {

          if (isSupported) {
            // start advertising
            cordova.plugins.locationManager.startAdvertising(beaconRegion)
              .fail(console.error)
              .done();
          } else {
            console.log("Advertising not supported");
          }
        })
        .fail(function(e) { console.error(e); })
        .done();
    }
  }

  /** @private */
  _stopAdvertising() {
    if (this._cordovaPluginInstalled){
      cordova.plugins.locationManager.stopAdvertising()
        .fail(function(e) { console.error(e); })
        .done();
      }
  }

  /** @private */
  _startRanging() {

    if (this._cordovaPluginInstalled){

      var delegate = new cordova.plugins.locationManager.Delegate();
      delegate.didRangeBeaconsInRegion = this._didRangeBeaconsInRegion;
      cordova.plugins.locationManager.setDelegate(delegate);

      var uuid = this._beaconData.uuid;
      var identifier = this._beaconData.identifier;
      var beaconRegion = new cordova.plugins.locationManager.BeaconRegion(identifier, uuid);

      // required in iOS 8+
      cordova.plugins.locationManager.requestWhenInUseAuthorization();
      // or cordova.plugins.locationManager.requestAlwaysAuthorization()

      cordova.plugins.locationManager.startRangingBeaconsInRegion(beaconRegion)
        .fail(function(e) { console.error(e); })
        .done();
    }
  }

  /** @private */
  _didRangeBeaconsInRegion(pluginResult) {
    // call user defined callbacks
    this._callbacks.forEach(function(callback) {
      callback(pluginResult);
    });
  }

  /** @private */
  _stopRanging() {
    if (this._cordovaPluginInstalled){
      var uuid = this._beaconData.uuid;
      var identifier = this._beaconData.identifier;
      var beaconRegion = new cordova.plugins.locationManager.BeaconRegion(identifier, uuid);

      cordova.plugins.locationManager.stopRangingBeaconsInRegion(beaconRegion)
        .fail(function(e) { console.error(e); })
        .done();
    }
  }

  /** @private */
  _checkPlugin() {

    var display_install_instruction = false;

    var plugins = cordova.require("cordova/plugin_list").metadata;
    if (typeof plugins[CORDOVA_PLUGIN_NAME] === "undefined") {
      console.warn('Cordova plugin <cordova-plugin-ibeacon> not installed -> beacon service disabled');
      display_install_instruction = true;
    } else {
      if (plugins[CORDOVA_PLUGIN_NAME] != CORDOVA_PLUGIN_ASSERTED_VERSION) {
        console.warn('Cordova plugin <cordova-plugin-ibeacon> version mismatch: installed: ' + plugins[CORDOVA_PLUGIN_NAME] + ' required: ' + CORDOVA_PLUGIN_ASSERTED_VERSION + ' (version not tested, use at your own risk)');
        display_install_instruction = true;
      }
      this._cordovaPluginInstalled = true;
    }
    if (display_install_instruction){
      console.log('-> to install ' + CORDOVA_PLUGIN_NAME + ' v' + CORDOVA_PLUGIN_ASSERTED_VERSION + ', use:', 'cordova plugin add ' + CORDOVA_PLUGIN_REPOSITORY + '#' + CORDOVA_PLUGIN_ASSERTED_VERSION);
    }
  }

  /**
  * Get advertising iBeacon region UUID
  */
  get uuid() {
    return this._beaconData.uuid;
  }
  /**
  * Get advertising iBeacon major ID
  */
  get major () {
    return this._beaconData.major;
  }
  /**
  * Get advertising iBeacon minor ID
  */
  get minor () {
    return this._beaconData.minor;
  }

  /**
  * Set advertising iBeacon UUID
  * @param {String} val - new UUID
  */
  set uuid(val) { // USE AT YOUR OWN RISKS
    this._stopAdvertising();
    this._stopRanging();
    this._beaconData.uuid = val;
    this.options.uuid = val;
    this._startAdvertising();
    this._startRanging();
  }

  /**
  * Set advertising iBeacon major ID
  * @param {Number} val - new major ID
  */
  set major (val) {
    if ( (val <= 65535) && (val >= 0) ){
      this._stopAdvertising();
      this._beaconData.major = val;
      this._startAdvertising();
    }
    else {
      console.warn('WARNING: attempt to define invalid major value: ', val, ' (must be in range [0,65535]');
    }
  }

  /**
  * Set advertising iBeacon minor ID
  * @param {Number} val - new minor ID
  */
  set minor (val) {
    if ( (val <= 65535) && (val >= 0) ){
      this._stopAdvertising();
      this._beaconData.minor = val;
      this._startAdvertising();
    }
    else {
      console.warn('WARNING: attempt to define invalid minor value: ', val, ' (must be in range [0,65535]');
    }
  }

}

serviceManager.register(SERVICE_ID, Beacon);

export default Beacon;
