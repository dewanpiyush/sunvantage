export default function Home() {
  return (
    <main
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#0B1F3A",
        color: "white",
        textAlign: "center",
        padding: "20px",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>SunVantage 🌅</h1>
      <p style={{ opacity: 0.8 }}>
        Witness the sunrise.
        <br />A quiet ritual shared across the world.
      </p>
      <p style={{ marginTop: "2rem", fontSize: "0.9rem", opacity: 0.6 }}>
        Coming soon.
      </p>
      <div style={{ marginTop: "40px", fontSize: "0.9rem", opacity: 0.6 }}>
        <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
      </div>
    </main>
  );
}
