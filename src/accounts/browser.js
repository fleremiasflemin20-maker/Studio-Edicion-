import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
window.FleremahiasPasskeys = { startRegistration, startAuthentication, browserSupportsWebAuthn };
