import Entity from '../Entity';
import Server from '../../Server';
import World from '../../world/World';

export default class WitherSkeleton extends Entity {
    public static MOB_ID = 'minecraft:wither_skeleton';

    public constructor(world: World, server: Server) {
        super(world, server);
    }
}
