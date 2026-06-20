from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

# Load credentials from your .env file
load_dotenv()

class KnowledgeGraphReader:
    def __init__(self):
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")
        
        # Establish the connection to the existing database
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        print("✅ Successfully connected to the existing Knowledge Graph!")

    def close(self):
        self.driver.close()

    def test_connection_get_freelancers(self):
        """
        A simple query to prove we are reading the existing data.
        It fetches all freelancer names currently in the database.
        """
        query = """
        MATCH (f:Freelancer)
        RETURN f.name AS name
        """
        
        # We use session.read_transaction for querying data (safer than write)
        with self.driver.session() as session:
            result = session.run(query)
            
            freelancers = [record["name"] for record in result]
            return freelancers

# --- Usage Example ---
if __name__ == "__main__":
    # 1. Initialize the reader (this connects to your active database)
    reader = KnowledgeGraphReader()
    
    # 2. Run a test query to pull data
    print("\n🔍 Fetching Freelancers from the existing graph...")
    existing_freelancers = reader.test_connection_get_freelancers()
    
    if existing_freelancers:
        for person in existing_freelancers:
            print(f"   👤 Found: {person}")
    else:
        print("   ⚠️ Connected, but no freelancers found. Did you delete the graph?")
        
    # 3. Always close the connection
    reader.close()