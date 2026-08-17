export type ErrorMessage = {
  error: string;
  status: number;
};

export const buildErrorMessage = ({
  message,
  httpStatus,
}: {
  message: string;
  httpStatus: number;
}) => {
  const error: ErrorMessage = {
    error: message,
    status: httpStatus,
  };

  return Response.json(error, {
    status: httpStatus,
  });
};
