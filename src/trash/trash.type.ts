export type DeletedObject = {
  id: string;
  name: string;
  address: string;
  deleted_at: string;
  deleted_by_name: string | null;
};

export type DeletedTask = {
  id: string;
  title: string;
  object_id: string;
  object_name: string;
  object_deleted: boolean;
  deleted_at: string;
  deleted_by_name: string | null;
};
