import { createClient } from "redis";

class RedisClient {
 constructor() {
    this.client = createClient();
    
    this.client.on('error', err => {
        console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
        console.log('Redis Client connected to the server');
    });
 }

 isAlive() {
    if (this.client.on) {
        return true;
    } else {
        return false;
    }
 }
 
 async get(stringkey) {
    return await this.client.get(stringkey);
 }

 async set(stringkey, value, duration) {
    await this.client.set(stringkey, value);
    await this.client.expire(stringkey, duration);
 }

 async del(stringkey) {
    await this.client.del(stringkey);
 }

 
}

const redisClient = new RedisClient()
export default redisClient;