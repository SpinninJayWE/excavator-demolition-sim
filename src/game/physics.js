import * as RAPIER from '@dimforge/rapier3d-compat'

let ready = false

export async function ensureRapier() {
  if (!ready) {
    await RAPIER.init()
    ready = true
  }
}

export const GROUP = {
  WORLD: 0b00001,
  BUILDING: 0b00010,
  DEBRIS: 0b00100,
  MACHINE: 0b01000,
  BUCKET: 0b10000,
}

// Rapier 的 InteractionGroups 为打包数字：低 16 位 groups，高 16 位 masks
export function IG(groups, masks = 0xffff) {
  return ((groups & 0xffff) << 16) | (masks & 0xffff)
}

export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    this.queue = new RAPIER.EventQueue(true)
  }

  step(dt) {
    this.world.timestep = dt
    this.world.step(this.queue)
  }

  drainContacts(fn) {
    this.queue.drainCollisionEvents(fn)
  }

  addGround() {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(150, 1, 150)
        .setTranslation(0, -1, 0)
        .setFriction(1.0)
        .setCollisionGroups(IG(GROUP.WORLD)),
      body,
    )
    return { body, collider }
  }

  addFixedCuboid(pos, half, groups, userData) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z))
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setFriction(0.75)
        .setRestitution(0.05)
        .setCollisionGroups(IG(groups)),
      body,
    )
    if (userData) collider.userData = userData
    return { body, collider }
  }

  addSensor(pos, half) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z))
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(IG(GROUP.WORLD, GROUP.DEBRIS)),
      body,
    )
    return { body, collider }
  }

  addKinematic(pos, half, groups) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z))
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setFriction(0.85)
        .setCollisionGroups(IG(groups)),
      body,
    )
    return { body, collider }
  }

  addKinematicBall(pos, radius, groups) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z))
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(radius)
        .setFriction(0.9)
        .setCollisionGroups(IG(groups)),
      body,
    )
    return { body, collider }
  }

  addDebrisChunk(pos, half, density, groups, rot) {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(0.12)
      .setAngularDamping(0.55)
      .setCanSleep(true)
    if (rot) desc.setRotation(rot)
    const body = this.world.createRigidBody(desc)
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setDensity(density)
        .setFriction(0.7)
        .setRestitution(0.08)
        .setCollisionGroups(IG(groups)),
      body,
    )
    return { body, collider }
  }

  removeFixed(chunk) {
    this.world.removeCollider(chunk.collider, true)
    this.world.removeRigidBody(chunk.body)
  }

  moveKinematic(body, pos, quat) {
    if (!body) return
    body.setNextKinematicTranslation(pos)
    body.setNextKinematicRotation(quat)
  }

  intersectsBall(collider, center, radius) {
    return collider.intersectsShape(new RAPIER.Ball(radius), center, { w: 1, x: 0, y: 0, z: 0 })
  }
}
