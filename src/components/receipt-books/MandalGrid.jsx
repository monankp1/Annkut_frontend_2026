import React from "react";
import { Grid, Card, CardContent, Chip, Typography, Paper } from "@mui/material";
import { num } from "../../api/annkut";

const MandalGrid = ({ mandals = [], loading = false, onClickMandal }) => {
  return (
    <Grid container spacing={2}>
      {(mandals || []).map((m) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={m?.id}>
          <Card
            variant="outlined"
            onClick={() => onClickMandal?.(m)}
            sx={{
              cursor: "pointer",
              borderColor: "divider",
              transition: "box-shadow 120ms ease",
              "&:hover": { boxShadow: 3 },
            }}
          >
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {m?.name || "Mandal"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m?.area_name || "—"}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={`${num(m?.sevaks)} sevaks`}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      ))}

      {(mandals?.length ?? 0) === 0 && (
        <Grid item xs={12}>
          <Paper sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>
            {loading ? "Loading mandals…" : "No mandals found"}
          </Paper>
        </Grid>
      )}
    </Grid>
  );
};

export default MandalGrid;
