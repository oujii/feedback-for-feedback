<script>
  import Auth from './components/Auth.svelte';
  import Login from './components/Login.svelte';
  import Button from './components/Button.svelte';
  import DisplayFeedback from './components/DisplayFeedback.svelte';
  import AddFeedback from './components/AddFeedback.svelte';

  let isLoadingAuth = true;
  let isLoggedIn = false;

  userbase
    .init({ appId: '5603514f-012b-4412-9956-cb04483a6ca7' })
    .then((session) => {
      if (session.user) isLoggedIn = true;
    })
    .catch((error) => console.log(error))
    .finally(() => (isLoadingAuth = false));

  const userbaseSession = localStorage.getItem('userbaseCurrentSession');

  if (userbaseSession) {
    isLoggedIn = JSON.parse(userbaseSession).signedIn;
  }

  function handleSignout() {
    userbase.signOut().then(() => (isLoggedIn = false));
  }
</script>

<main>
  {#if !isLoadingAuth && isLoggedIn}
    <Button
      on:click={handleSignout}
      style="position: fixed; top: 10px; left: 10px;">Sign out</Button
    >
  {/if}
  {#if isLoadingAuth}
    Loading ...
  {:else}
    {#if isLoggedIn === false}
      <Auth bind:isLoggedIn />
      <Login bind:isLoggedIn />
    {/if}
    {#if isLoggedIn}
      <AddFeedback />
      <DisplayFeedback />
    {/if}
  {/if}
</main>

<style>
  main {
    font-family: comic-sans;
    text-align: center;
  }
</style>
