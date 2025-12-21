#!/usr/bin/env bun

async function run(cmd: string[], input?: string) {
  const proc = Bun.spawn(cmd, {
    stdin: input ? "pipe" : "inherit",
    stdout: "pipe",
    stderr: "pipe"
  })

  if (input && proc.stdin) {
    proc.stdin.write(input)
    proc.stdin.end()
  }

  const out = await new Response(proc.stdout).text()
  const err = await new Response(proc.stderr).text()

  const code = await proc.exited
  if (code !== 0) {
    throw new Error(err || out)
  }

  return out.trim()
}

async function resolveRepo(input: string): Promise<string> {
  if (input.includes("/")) return input

  const out = await run([
    "gh",
    "repo",
    "view",
    input,
    "--json",
    "owner,name"
  ])

  const data = JSON.parse(out)
  return `${data.owner.login}/${data.name}`
}



function filterByVisibility(
  repos: any[],
  visibility: "public" | "private"
) {
  return repos.filter(
    r => r.visibility?.toLowerCase() === visibility
  )
}

function filterByMonthsAgo(repos: any[], months: number) {
  const now = Date.now()
  const limit = now - months * 30 * 24 * 60 * 60 * 1000

  return repos.filter(r =>
    new Date(r.updatedAt).getTime() >= limit
  )
}


function filterOlderThanMonths(repos: any[], months: number) {
  const now = Date.now()
  const limit = now - months * 30 * 24 * 60 * 60 * 1000

  return repos.filter(r =>
    r.updatedAt &&
    new Date(r.updatedAt).getTime() < limit
  )
}

function sortByUpdated(
  repos: any[],
  order: "asc" | "desc" = "desc"
) {
  return [...repos].sort((a, b) =>
    order === "desc"
      ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      : new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
  )
}
function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question)
    process.stdin.once("data", (data) => {
      resolve(data.toString().trim())
    })
  })
}

function line() {
  console.log("────────────────────────────────")
}

/* =====================================
   GH WRAPPER
===================================== */

const gh = {
  repo: {
    list: async () =>
      JSON.parse(
        await run([
          "gh",
          "repo",
          "list",
          "--limit",
          "1000",
          "--json",
          "name,visibility,url,updatedAt,createdAt,pushedAt"
        ])
      ),
    add: async (name: string, visibility: string) =>
      run(["gh", "repo", "create", name, `--${visibility}`, "--confirm"]),

    delete: async (repo: string) =>
      run(["gh", "repo", "delete", repo, "--yes"])
  },

  secret: {
    list: async (repoInput: string) => {
      const repo = await resolveRepo(repoInput)

      return JSON.parse(
        await run([
          "gh",
          "secret",
          "list",
          "--repo",
          repo,
          "--json",
          "name,updatedAt"
        ])
      )
    },

    set: async (repoInput: string, key: string, value: string) => {
      const repo = await resolveRepo(repoInput)

      return run(
        ["gh", "secret", "set", key, "--repo", repo],
        value
      )
    }
  },

  variable: {
    list: async (repoInput: string) => {
      const repo = await resolveRepo(repoInput)

      return JSON.parse(
        await run([
          "gh",
          "variable",
          "list",
          "--repo",
          repo,
          "--json",
          "name,value,updatedAt"
        ])
      )
    },

    set: async (repoInput: string, key: string, value: string) => {
      const repo = await resolveRepo(repoInput)

      return run([
        "gh",
        "variable",
        "set",
        key,
        "--repo",
        repo,
        "--body",
        value
      ])
    }
  }
}


/* =====================================
   INTERACTIVE MENU
===================================== */
async function menu() {
  while (true) {
    line()
    console.log("GitHub Helper (ghh)")
    line()

    console.log("1. List repo")
    console.log("2. Add repo")
    console.log("3. Delete repo")
    console.log("4. Add secret")
    console.log("5. Add variable")
    console.log("6. List secrets")
    console.log("7. List variables")
    console.log("8. List public repos")
    console.log("9. List private repos")
    console.log("10. Repo updated last X months")
    console.log("0. Exit")

    line()

    const choice = await ask("Choose: ")

    if (choice === "1") {
      console.table(await gh.repo.list())
    }

    if (choice === "2") {
      const name = await ask("Repo name: ")
      const visibility = await ask("Visibility (public/private): ")
      await gh.repo.add(name, visibility || "private")
      console.log("✅ Repo created")
    }

    if (choice === "3") {
      const repo = await ask("owner/repo: ")
      await gh.repo.delete(repo)
      console.log("🗑 Repo deleted")
    }

    if (choice === "4") {
      const repo = await ask("Repo (owner/name): ")
      const key = await ask("Secret key: ")
      const value = await ask("Secret value: ")
      await gh.secret.set(repo, key, value)
      console.log("🔐 Secret saved")
    }

    if (choice === "5") {
      const repo = await ask("Repo (owner/name): ")
      const key = await ask("Variable key: ")
      const value = await ask("Variable value: ")
      await gh.variable.set(repo, key, value)
      console.log("📦 Variable saved")
    }
    if (choice === "6") {
      const repo = await ask("Repo (owner/name): ")
      const secrets = await gh.secret.list(repo)
      console.table(secrets)
    }
    if (choice === "7") {
      const repo = await ask("Repo (owner/name): ")
      const vars = await gh.variable.list(repo)
      console.table(vars)
    }
    if (choice === "8") {
      const repos = await gh.repo.list()
      console.table(filterByVisibility(repos, "public"))
    }

    if (choice === "9") {
      const repos = await gh.repo.list()
      console.table(filterByVisibility(repos, "private"))
    }

    if (choice === "10") {
      const months = Number(await ask("Last how many months?: "))
      const repos = await gh.repo.list()
      console.table(filterByMonthsAgo(repos, months))
    }

    if (choice === "0") {
      process.exit(0)
    }
  }
}

/* =====================================
   ARGUMENT PARSER (MINIMAL)
===================================== */
const [, , cmd, ...args] = process.argv

  ; (async () => {
    if (!cmd || cmd === "menu") {
      await menu()
      return
    }

    if (cmd === "list") {
      console.table(await gh.repo.list())
      return
    }

    if (cmd === "add") {
      const [name, visibility = "private"] = args
      if (!name) throw new Error("Repo name required")
      await gh.repo.add(name, visibility)
      console.log("✅ Repo created")
      return
    }

    console.log(`
Usage:
  bun run gitHubCli.ts
  bun run gitHubCli.ts menu
  bun run gitHubCli.ts list
  bun run gitHubCli.ts add <name> [public|private]
`)
  })()
