<h1 align="center">Post Room Backend</h1>

## Overview

Full-stack blog posts web app built with Next.js, PostgreSQL and Express.js with Typescript.

feel free to check this project's [front-end](https://github.com/Ako-Mawlood/Post-Room)

## Getting started

Clone this project:

```bash
git clone https://github.com/Abdullah-988/post-room-backend
```

To install dependencies:

```bash
npm install
```

Setup `.env` file:

```
DATABASE_URL=

PORT=

JWT_SECRET=

NODEMAILER_SERVICE=
NODEMAILER_EMAIL=
NODEMAILER_PASSWORD=
```

Initialize the database:

```bash
npx prisma db push
```

Run dev server:

```bash
npm run dev
```

## License

Post Room is released under the [MIT License](https://opensource.org/licenses/MIT).
