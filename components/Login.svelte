<script>
  export let isLoggedIn;
  let username = '';
  let password = '';
  let error = '';

  function handleLogin(e) {
    e.preventDefault();

    userbase
      .signIn({ username, password, rememberMe: 'local' })
      .then((user) => {
        console.log('Logged in!');
        isLoggedIn = true;
      })
      .catch((errorFromApi) => (error = errorFromApi));
  }
</script>

<h1>Login</h1>
<form id="login-form" on:submit={handleLogin}>
  <input type="text" required placeholder="Username" bind:value={username} />
  <input
    type="password"
    required
    placeholder="Password"
    bind:value={password}
  />
  <input type="submit" value="Sign in" />
</form>
<div id="login-error">{error}</div>
