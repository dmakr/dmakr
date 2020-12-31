import test from "ava";
import gitRemote from "./gitRemote.js";

test("local file system", (t) => {
  t.is("/local/file", gitRemote("/local/file"));
});

test("url without credentials", (t) => {
  t.is("https://xn--g6w251d/", gitRemote("https://測試"));
});

test("url with credentials", (t) => {
  t.is(
    gitRemote("https://sub.example.com:8080/p/a/t/h", {
      user: "user",
      pass: "pass",
    }),
    "https://user:pass@sub.example.com:8080/p/a/t/h"
  );
});
