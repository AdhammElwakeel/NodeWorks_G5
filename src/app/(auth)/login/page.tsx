import { Button, Container, Title, TextInput, PasswordInput, Paper, Text, Group } from '@mantine/core';

export default function LoginPage() {
  return (
    <Container size={420} my={40}>
      <Title ta="center" className="font-bold">
        Welcome back!
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Do not have an account yet?{' '}
        <Text component="a" href="#" size="sm" variant="link">
          Create account
        </Text>
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <TextInput label="Email" placeholder="you@mantine.dev" required />
        <PasswordInput label="Password" placeholder="Your password" required mt="md" />
        <Group justify="space-between" mt="lg">
          <Text component="a" href="#" size="sm" variant="link">
            Forgot password?
          </Text>
        </Group>
        <Button fullWidth mt="xl">
          Sign in
        </Button>
      </Paper>
    </Container>
  );
}
