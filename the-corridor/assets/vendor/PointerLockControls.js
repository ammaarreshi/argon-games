import { Euler, EventDispatcher, Vector3 } from './three.module.js';

const _euler = new Euler(0, 0, 0, 'YXZ');
const _vector = new Vector3();

const _changeEvent = { type: 'change' };
const _lockEvent = { type: 'lock' };
const _unlockEvent = { type: 'unlock' };

const _PI_2 = Math.PI / 2;

class PointerLockControls extends EventDispatcher {
  constructor(camera, domElement) {
    super();

    this.camera = camera;
    this.domElement = domElement;

    this.isLocked = false;

    // Set to constrain the pitch of the camera
    // Range is 0 to Math.PI radians
    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    this.pointerSpeed = 1.0;

    const scope = this;

    function onMouseMove(event) {
      if (scope.isLocked === false) return;

      const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

      _euler.setFromQuaternion(camera.quaternion);

      _euler.y -= movementX * 0.002 * scope.pointerSpeed;
      _euler.x -= movementY * 0.002 * scope.pointerSpeed;

      _euler.x = Math.max(_PI_2 - scope.maxPolarAngle, Math.min(_PI_2 - scope.minPolarAngle, _euler.x));

      camera.quaternion.setFromEuler(_euler);

      scope.dispatchEvent(_changeEvent);
    }

    function onPointerlockChange() {
      if (scope.domElement.ownerDocument.pointerLockElement === scope.domElement) {
        scope.dispatchEvent(_lockEvent);
        scope.isLocked = true;
      } else {
        scope.dispatchEvent(_unlockEvent);
        scope.isLocked = false;
      }
    }

    function onPointerlockError() {
      console.warn('THREE.PointerLockControls: Unable to use Pointer Lock API.');
    }

    this.connect = function () {
      scope.domElement.ownerDocument.addEventListener('mousemove', onMouseMove);
      scope.domElement.ownerDocument.addEventListener('pointerlockchange', onPointerlockChange);
      scope.domElement.ownerDocument.addEventListener('pointerlockerror', onPointerlockError);
    };

    this.disconnect = function () {
      scope.domElement.ownerDocument.removeEventListener('mousemove', onMouseMove);
      scope.domElement.ownerDocument.removeEventListener('pointerlockchange', onPointerlockChange);
      scope.domElement.ownerDocument.removeEventListener('pointerlockerror', onPointerlockError);
    };

    this.dispose = function () {
      this.disconnect();
    };

    this.getObject = function () {
      return camera;
    };

    this.getDirection = function (v) {
      return v.set(0, 0, -1).applyQuaternion(camera.quaternion);
    };

    this.moveForward = function (distance) {
      const camera = scope.camera;
      _vector.setFromMatrixColumn(camera.matrix, 0);
      _vector.crossVectors(camera.up, _vector);
      camera.position.addScaledVector(_vector, distance);
    };

    this.moveRight = function (distance) {
      const camera = scope.camera;
      _vector.setFromMatrixColumn(camera.matrix, 0);
      camera.position.addScaledVector(_vector, distance);
    };

    this.lock = function () {
      if (this.domElement && this.domElement.requestPointerLock) {
        try {
          const p = this.domElement.requestPointerLock();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {}
      }
    };

    this.unlock = function () {
      if (scope.domElement.ownerDocument.exitPointerLock) {
        scope.domElement.ownerDocument.exitPointerLock();
      }
    };

    this.connect();
  }
}

export { PointerLockControls };
