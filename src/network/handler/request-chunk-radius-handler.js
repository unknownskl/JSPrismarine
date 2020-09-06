const { Worker } = require('worker_threads')

const Identifiers = require('../identifiers')
const RequestChunkRadiusPacket = require('../packet/request-chunk-radius')
const NetworkChunkPublisherUpdatePacket = require('../packet/network-chunk-publisher-update')
const PlayStatus = require('../type/play-status')
const Player = require('../../player')
const Chunk = require('../../level/chunk/chunk')
const SubChunk = require('../../level/chunk/sub-chunk')
const CoordinateUtils = require('../../level/coordinate-utils')

'use strict'

class RequestChunkRadiusHandler {
    static NetID = Identifiers.RequestChunkRadiusPacket

    /**
     * @param {RequestChunkRadiusPacket} packet 
     * @param {Player} player 
     */
    static handle(packet, player) {
        player.setViewDistance(packet.radius)

        setTimeout(() => player.sendNetworkChunkPublisher(), 250)

        /* let worker = new Worker(__dirname + '../../../level/flat-generator-test.js')
        worker.postMessage(player.viewDistance)
        
        worker.on('message', function(chunk) {
            // We lose Chunk class while doing that
            // A Object.assign won't work for some reasons
            player.sendCustomChunk(
                chunk.chunkX,
                chunk.chunkZ,
                chunk.subCount,
                chunk.data
            )
        }) */

        // TO FIX, BUT WORKED!! 
        // The first time worked, then i touched the code (don't touch it if it works!!!)
        // and now the terrain is loaded from files but is invisible!
        /* setImmediate(function() {
            for (let chunkX = -16; chunkX < 16; chunkX++) {
                for (let chunkZ = -16; chunkZ < 16; chunkZ++) {
                    let chunk = player.getServer().defaultLevel.getChunk(chunkX, chunkZ)
                    player.sendChunk(chunk)
                }
            }
        }.bind(player)) */ 

        player.sendPlayStatus(PlayStatus.PlayerSpawn)
    }
}
module.exports = RequestChunkRadiusHandler