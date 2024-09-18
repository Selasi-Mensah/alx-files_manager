import dbClient from "../utils/db";
import sha1 from 'sha';
import { ObjectId } from 'mongodb';

class UsersController{
    static async postNew(req, res) {
        const { email, password } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Missing email' })
        }

        if (!password) {
            return res.status(400).json({ error: 'Missing password' });
        }


        const existingUser = await dbClient.client.collection('users').findOne({ email: });

        if (existingUser) {
            return res.status(400).json({ error: 'Already exist' });
        }

        const hashedPassword = sha1(password);


        const newUser = {
            email, password: hashedPassword,
        };

        const result = dbClient.client.collection('users').insertOne(newUser);

        return res.status(400).json({ id: result.insertedId, email})

    }

}
export default UsersController;
