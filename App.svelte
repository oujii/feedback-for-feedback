<script>
 import Button from "./Button.svelte";
 import Auth from "./Auth.svelte";
 import Login from "./Login.svelte";
 import Todos from "./Todos.svelte";
 import AddTodo from "./AddTodo.svelte";

 let isLoggedIn = false;
</script>

<style>
  main {
    font-family: comic-sans;
    text-align: center;
  }
</style>

<main>
{#if isLoggedIn === false}
      <Auth bind:isLoggedIn />
    <Login bind:isLoggedIn />
{/if}
  {#if isLoggedIn}
  <AddTodo />
  <Todos />
{/if}
</main>

