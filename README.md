This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Docker Deployment

### Prerequisites

- Docker and Docker Compose installed on your machine.

### Running with Docker Compose

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/yourusername/bubble-quiz.git
    cd bubble-quiz
    ```

2.  **Configure Environment Variables:**
    The `docker-compose.yml` file comes with default environment variables. For production, you should update `NEXTAUTH_SECRET` and other provider secrets.

    You can create a `.env` file or modify `docker-compose.yml` directly.

3.  **Run the container (Build from source):**

    ```bash
    docker-compose up -d
    ```

    The application will be available at `http://localhost:3000`.
    The SQLite database will be persisted in the `./data` directory.

### Running with Pre-built Image (Production)

If you want to run the application using the pre-built image from GitHub Container Registry without building it locally:

1.  **Use the production compose file:**

    Edit `docker-compose.prod.yml` and replace `your_github_username` with your actual username.

    ```bash
    docker-compose -f docker-compose.prod.yml up -d
    ```

### Building the Docker Image Manually

```bash
docker build -t bubble-quiz .
docker run -p 3000:3000 -v $(pwd)/data:/app/data -e DATABASE_URL="file:/app/data/db.sqlite" bubble-quiz
```

### GitHub Actions

This repository includes a GitHub Workflow that automatically builds and pushes a Docker image to the GitHub Container Registry (GHCR) whenever changes are pushed to the `main` branch. The image is tagged with the version specified in `package.json` and `latest`.

## Testing

The project uses [Vitest](https://vitest.dev/) for unit and integration testing.

### Running Tests

To run the tests once:

```bash
yarn test
```

### Development Mode

To run tests in watch mode during development:

```bash
yarn test:watch
```

### Coverage Report

To generate a coverage report:

```bash
yarn test:coverage
```
