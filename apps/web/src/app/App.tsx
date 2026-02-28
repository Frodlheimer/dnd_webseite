import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { HomeRoute } from '../routes/HomeRoute';

export const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
      </Routes>
    </BrowserRouter>
  );
};
