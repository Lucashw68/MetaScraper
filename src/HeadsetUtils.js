import headsets from './Headsets.js';

export default class HeadsetUtils {
  static getHeadsetByCode(code) {
    return headsets.find(headset => headset.code === code);
  }

  static getHeadsetById(id) {
    return headsets.find(headset => headset.id === id);
  }

  static getHeadsetByName(name) {
    return headsets.find(headset => headset.name === name);
  }

  static getHeadsetsNamesByCodes(codes) {
    return codes.map(code => this.getHeadsetByCode(code).name);
  }
}
