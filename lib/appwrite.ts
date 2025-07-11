import { Client, Account, Databases,Storage, ID, Query, Permission, Role } from "appwrite"

const client = new Client()
  .setEndpoint("https://fra.cloud.appwrite.io/v1") // 🔁 Change if you're using self-hosted Appwrite
  .setProject("686d1ae70002e1019d31"); 

const account = new Account(client)
const databases = new Databases(client)
const storage = new Storage(client)

export { client, account, storage,databases, ID, Query, Permission, Role } 
