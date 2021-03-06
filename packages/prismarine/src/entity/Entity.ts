import MetadataManager, { FlagType, MetadataFlag } from './Metadata';

import AddActorPacket from '../network/packet/AddActorPacket';
import AttributeManager from './Attribute';
import MoveActorAbsolutePacket from '../network/packet/MoveActorAbsolutePacket';
import Player from '../player/Player';
import Position from '../world/Position';
import RemoveActorPacket from '../network/packet/RemoveActorPacket';
import Server from '../Server';
import Vector3 from '../math/Vector3';
import World from '../world/World';

// All entities will extend this base class
export default class Entity extends Position {
    protected static MOB_ID: string;
    public static runtimeIdCount = 0n;

    private runtimeId: bigint;

    private server: Server;
    // TODO: do not expose and make API instead
    private readonly metadata: MetadataManager = new MetadataManager();
    private readonly attributes: AttributeManager = new AttributeManager();

    /**
     * Entity constructor.
     */
    public constructor(world: World, server: Server) {
        super({ world }); // TODO
        Entity.runtimeIdCount += 1n;
        this.runtimeId = Entity.runtimeIdCount;
        this.server = server;

        this.metadata.setLong(MetadataFlag.INDEX, 0n);
        this.metadata.setShort(MetadataFlag.MAX_AIR, 400);
        this.metadata.setLong(MetadataFlag.ENTITY_LEAD_HOLDER_ID, -1n);
        this.metadata.setFloat(MetadataFlag.SCALE, 1);
        this.metadata.setFloat(MetadataFlag.BOUNDINGBOX_WIDTH, 0.6);
        this.metadata.setFloat(MetadataFlag.BOUNDINGBOX_HEIGHT, 1.8);
        this.metadata.setShort(MetadataFlag.AIR, 0);

        this.setGenericFlag(MetadataFlag.AFFECTED_BY_GRAVITY, true);
        this.setGenericFlag(MetadataFlag.HAS_COLLISION, true);

        // Server could potentially be undefined
        this.server?.getEventManager().on('tick', async (evt) => this.update(evt.getTick()));
    }

    /**
     * Get the entity's runtime id.
     */
    public getRuntimeId(): bigint {
        return this.runtimeId;
    }

    /**
     * Fired every thick from the event subscription in the constructor.
     * @param tick current tick
     */
    public async update(tick: number) {
        const collisions = await this.getNearbyEntities(0.5);
        await Promise.all(collisions.map(async (e) => e.onCollide(this)));
    }

    public getServer(): Server {
        return this.server;
    }

    public setNameTag(name: string) {
        this.metadata.setString(MetadataFlag.NAMETAG, name);
    }

    public setDataFlag(propertyId: number, flagId: number, value = true, propertyType = FlagType.LONG) {
        // All generic flags are written as Longs (bigints) 64bit
        const flagId64 = BigInt(flagId);
        // Check if the same value is already set
        if (this.getDataFlag(propertyId, flagId64) !== value) {
            const flags = this.metadata.getPropertyValue(propertyId) as bigint;
            this.metadata.setPropertyValue(propertyId, propertyType, flags ^ (1n << flagId64));
        }
    }

    public getDataFlag(propertyId: number, flagId: bigint) {
        return ((this.metadata.getPropertyValue(propertyId) as bigint) & (1n << flagId)) > 0;
    }

    public setGenericFlag(flagId: number, value = true) {
        this.setDataFlag(flagId >= 64 ? 94 : MetadataFlag.INDEX, flagId % 64, value, FlagType.LONG);
    }

    public getAttributeManager(): AttributeManager {
        return this.attributes;
    }

    public getMetadataManager(): MetadataManager {
        return this.metadata;
    }

    /**
     * Spawn the entity.
     * @param player optional - if specified, only send the packet to that player
     */
    public async sendSpawn(player?: Player) {
        const players: Player[] = player
            ? [player]
            : (this.getWorld()
                  .getEntities()
                  .filter((e) => e.isPlayer()) as Player[]);

        const pk = new AddActorPacket();
        pk.runtimeEntityId = this.getRuntimeId();
        pk.type = (this.constructor as any).MOB_ID; // TODO
        pk.x = this.getX();
        pk.y = this.getY();
        pk.z = this.getZ();
        // TODO: motion
        pk.motionX = 0;
        pk.motionY = 0;
        pk.motionZ = 0;
        pk.pitch = 0;
        pk.yaw = 0;
        pk.headYaw = 0;
        pk.metadata = this.metadata.getMetadata();
        await Promise.all(players.map(async (p) => p.getConnection().sendDataPacket(pk)));
    }

    /**
     * Despawn the entity.
     * @param player optional - if specified, only send the packet to that player
     */
    public async sendDespawn(player?: Player) {
        const players: Player[] = player
            ? [player]
            : (this.getWorld()
                  .getEntities()
                  .filter((e) => e.isPlayer()) as Player[]);

        const pk = new RemoveActorPacket();
        pk.uniqueEntityId = this.runtimeId;
        await Promise.all(players.map(async (p) => p.getConnection().sendDataPacket(pk)));
    }

    /**
     * Set entity's position and notify the clients.
     * @param position the position
     */
    public async setPosition(position: Vector3) {
        await this.setX(position.getX(), true);
        await this.setY(position.getY(), true);
        await this.setZ(position.getZ(), true);

        await this.sendPosition();
    }

    /**
     * Send the position to all the players in the same world.
     */
    public async sendPosition() {
        this.getServer()
            .getPlayerManager()
            .getOnlinePlayers()
            .filter((p) => p.getWorld().getUniqueId() === this.getWorld().getUniqueId())
            .map(async (player) => {
                const pk = new MoveActorAbsolutePacket();
                pk.runtimeEntityId = this.runtimeId;
                pk.position = this.getPosition();

                // TODO
                pk.rotationX = 0;
                pk.rotationY = 0;
                pk.rotationZ = 0;
                await player.getConnection().sendDataPacket(pk);
            });
    }

    public getPosition(): Vector3 {
        return new Vector3(this.getX(), this.getY(), this.getZ());
    }

    /**
     * Set the x position.
     * @param n x
     * @param preventMove if true the client won't be notified about the position change
     */
    public async setX(n: number, preventMove?: boolean) {
        super.setX.bind(this)(n);
        if (preventMove && !this.isPlayer()) await this.sendPosition();
    }
    /**
     * Set the y position.
     * @param n y
     * @param preventMove if true the client won't be notified about the position change
     */
    public async setY(n: number, preventMove?: boolean) {
        super.setY.bind(this)(n);
        if (preventMove && !this.isPlayer()) await this.sendPosition();
    }
    /**
     * Set the z position.
     * @param n z
     * @param preventMove if true the client won't be notified about the position change
     */
    public async setZ(n: number, preventMove?: boolean) {
        super.setZ.bind(this)(n);
        if (preventMove && !this.isPlayer()) await this.sendPosition();
    }

    /**
     * Check if the entity is a player.
     */
    public isPlayer(): boolean {
        return false;
    }

    /**
     * Get entity type.
     */
    public getType(): string {
        return (this.constructor as any).MOB_ID;
    }

    /**
     * Get the entities (potentially custom) name.
     */
    public getName(): string {
        return this.getFormattedUsername();
    }

    public getFormattedUsername(): string {
        return (
            this.metadata.getString(MetadataFlag.NAMETAG) ??
            // Replace all '_' with a ' ' and capitalize each word afterwards,
            // should probably be replaced with regex.
            ((this.constructor as any).MOB_ID as string)
                .split(':')[1]
                .replace(/_/g, ' ')
                .split(' ')
                .map((word) => word[0].toUpperCase() + word.slice(1, word.length))
                .join(' ')
        );
    }

    /**
     * Fired when a entity collides with another.
     * @param entity the entity collided with
     */
    public async onCollide(entity: Entity) {}

    /**
     * Returns the nearest entity from the current entity.
     *
     * TODO: Customizable radius
     * TODO: amount of results
     *
     * @param entities
     */
    public getNearestEntity(entities: Entity[] = this.server.getWorldManager().getDefaultWorld().getEntities()!) {
        const pos = new Vector3(this.getX(), this.getY(), this.getZ());
        const dist = (a: Vector3, b: Vector3) =>
            Math.sqrt((b.getX() - a.getX()) ** 2 + (b.getY() - a.getY()) ** 2 + (b.getZ() - a.getZ()) ** 2);

        const closest = (target: Vector3, points: Entity[], eps = 0.00001) => {
            const distances = points.map((e) => dist(target, new Vector3(e.getX(), e.getY(), e.getZ())));
            const closest = Math.min(...distances);
            return points.find((e, i) => distances[i] - closest < eps)!;
        };

        return [
            closest(
                pos,
                entities.filter((a) => a.runtimeId !== this.runtimeId)
            )
        ].filter((a) => a);
    }

    /**
     * Get entities within radius of current entity.
     * @param radius number
     */
    public async getNearbyEntities(radius: number): Promise<Entity[]> {
        const entities = this.getWorld().getEntities();
        const position = this.getPosition();

        const min = new Vector3(position.getX() - radius, position.getY() - radius, position.getZ() - radius);
        const max = new Vector3(position.getX() + radius, position.getY() + radius, position.getZ() + radius);

        const res = entities.filter((entity) => {
            if (entity.runtimeId === this.runtimeId) return false;

            const position = entity.getPosition();

            if (
                min.getX() < position.getX() &&
                max.getX() > position.getX() &&
                min.getY() < position.getY() &&
                max.getY() > position.getY() &&
                min.getZ() < position.getZ() &&
                max.getZ() > position.getZ()
            )
                return true;

            return false;
        });

        return res;
    }
}
