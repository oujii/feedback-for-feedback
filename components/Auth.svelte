<script>
  let username = '';
  let password = '';
  let error = '';
  export let isLoggedIn;

  function handleSignUp(e) {
    e.preventDefault();

    userbase
      .signUp({ username, password, rememberMe: 'local' })
      .then((user) => {
        console.log('Logged in!');
        isLoggedIn = true;
      })
      .catch((errorFromApi) => (error = errorFromApi));
  }
</script>

<div id="auth-view">
  <h1>Create an account</h1>
  <form id="signup-form" on:submit={handleSignUp}>
    <input type="text" required placeholder="Username" bind:value={username} />
    <input
      type="password"
      required
      placeholder="Password"
      bind:value={password}
    />
    <input type="submit" value="Create an account" />
  </form>
  <div id="signup-error">{error}</div>
</div>

<style>
  div {
    background-color: blue;
  }
</style>
