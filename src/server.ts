import app from './app';

const PORT = process.env.PORT || 3000;

// AstroVedham Backend Production Server
app.listen(PORT as number, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
