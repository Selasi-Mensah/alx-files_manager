import { MongoClient } from "mongodb";

class DBClient {
  constructor() {
    // Use environment variables or default values for connection details
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}`;

    // Initialize the MongoDB client
    this.client = new MongoClient(url, { useUnifiedTopology: true });

    // Connect to the MongoDB server
    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
        console.log('Connected to MongoDB');
      })
      .catch(err => console.error('Failed to connect to MongoDB:', err));
  }

  // Method to check if the MongoDB connection is alive
  async isAlive() {
    try {
      // Check if the client is connected
      return this.client.isConnected();
    } catch (error) {
      console.error('Error in isAlive:', error);
      return false;
    }
  }

  async nbUsers() {
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    return this.db.client.collection('files').countDocuments();
  }

}

// Create and export an instance of DBClient
const dbClient = new DBClient();
export default dbClient;
