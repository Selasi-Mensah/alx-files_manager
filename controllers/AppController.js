import redisClient from "../utils/redis";
import dbClient from "../utils/db";

class AppController {
    static async getStatus(req, res) {
        try {
            res.status(200).json({
                redis: redisClient.isAlive(),
                db: dbClient.isAlive(),
            });
        } catch (error) {
            console.log(500).json({error: 'Failed to get status'})
        }
    }

    static async getStats(req, res) {
        const usersCount = await dbClient.nbUsers();  // Count users
        const filesCount = await dbClient.nbFiles();  // Count files
    
        res.status(200).json({ users: usersCount, files: filesCount });  // Send stats response
      }
    }

    export default AppController;