import { v4 as uuidv4 } from 'uuidv4';
import dbClient from "../utils/db";
import sha1 from 'sha';
import redisClient from "../utils/redis";
import UsersController from './UserController';

class Authcontroller {
    static async getConnect(req, res) {
        const authHeader = req.headers.authorization || '';
        const base64Credentials = authHeader.split(" ")[1] || "";
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [email, password] = credentials.split(':');

        if (!email || password) {
            return res.status(400).json({ error: 'Unauthorized' });

        }


        //hash the password
        const hashedPassword = sha1(password);
        const user = await dbClient.client.db().collection('users').findOne({ email, password: hashedPassword });
        
        if (!user) {
            return res.status(400).json({ error: 'Unauthorized' })
        }

        const token = uuidv4;
        const key = `auth_${token}`;
        await redisClient.set(key, user._id.toString(), 86400);

        return res.status(200).json({ token });
    }

    static async getDisconnect(req, res) {
        const token = req.headers['x-token'];

        if (!token) {
            return res.status(400).json({ error: 'Unauthorized' });
        }

        const key = `auth_${token}`;
        const userId = await redisClient.get(key);

        if (!userId) {
            return res.status(400).json({ error: 'Unauthorized' });
        }


        return res.status(200).json({ id: user._id, email: user.email});
    }
}

export default UsersController;