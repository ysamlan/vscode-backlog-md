<script lang="ts">
  /**
   * Simple test component to verify the Svelte 5 build pipeline works.
   * This will be removed after Phase 1 verification.
   */
  let count = $state(0);

  function increment() {
    count++;
  }
</script>

<div class="hello-world">
  <h1>Hello from Svelte 5!</h1>
  <p>Count: {count}</p>
  <button onclick={increment}>
    Increment
  </button>
</div>

<style>
  .hello-world {
    padding: 1rem;
    font-family: system-ui, sans-serif;
  }

  button {
    padding: 0.5rem 1rem;
    cursor: pointer;
  }
</style>
