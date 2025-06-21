import { useNavigate } from "react-router-dom";
import "./Home.css";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="home-title">Welcome to Chat App</div>
        <div className="home-buttons">
          <button onClick={() => navigate("/login")} className="btn btn-login">
            Login
          </button>
          <button onClick={() => navigate("/register")} className="btn btn-register">
            Register
          </button>
        </div>
      </header>
      <main className="home-main">
        <h1>Your friendly chat platform</h1>
        <p>Connect with friends and family in real time.</p>
      </main>
    </div>
  );
}

export default Home;
